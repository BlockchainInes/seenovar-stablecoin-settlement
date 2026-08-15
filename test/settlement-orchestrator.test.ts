import { describe, expect, it } from "vitest";

import type {
  RegistryReconciliationResult,
  RegistryRegistrationResult,
} from "../src/blockchain/settlement-registry-client.js";
import {
  SimulatedEvmExecutor,
  type StablecoinExecutor,
  type StablecoinTransferRequest,
  type StablecoinTransferResult,
} from "../src/execution.js";
import { SettlementLedger } from "../src/ledger.js";
import { SettlementEngine } from "../src/settlement-engine.js";
import {
  SettlementOrchestrator,
  type SettlementRegistryGateway,
} from "../src/settlement-orchestrator.js";
import type { CreateSettlementInput } from "../src/settlement-engine.js";
import type { SettlementInstruction } from "../src/types.js";

function createInput(
  overrides: Partial<CreateSettlementInput> = {},
): CreateSettlementInput {
  return {
    idempotencyKey: crypto.randomUUID(),
    sender: {
      walletAddress: "0x1111111111111111111111111111111111111111",
      legalName: "Seenovar Treasury Europe",
      jurisdiction: "FR",
    },
    recipient: {
      walletAddress: "0x2222222222222222222222222222222222222222",
      legalName: "Institutional Counterparty",
      jurisdiction: "DE",
    },
    asset: {
      symbol: "USDC",
      decimals: 6,
      chainId: 1,
      contractAddress: "0xA0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
    },
    amount: "100000.00",
    ...overrides,
  };
}

function createApprovedSettlement(
  engine: SettlementEngine,
): string {
  const settlement = engine.create(createInput());

  engine.transition(
    settlement.id,
    "COMPLIANCE_PENDING",
  );

  engine.transition(
    settlement.id,
    "APPROVED",
  );

  return settlement.id;
}

class FailingExecutor implements StablecoinExecutor {
  async execute(
    _request: StablecoinTransferRequest,
  ): Promise<StablecoinTransferResult> {
    throw new Error("Simulated execution failure");
  }
}

class MockRegistryClient implements SettlementRegistryGateway {
  readonly registeredSettlementIds: string[] = [];
  readonly reconciledSettlementIds: string[] = [];

  async registerSettlement(
    settlement: SettlementInstruction,
  ): Promise<RegistryRegistrationResult> {
    this.registeredSettlementIds.push(
      settlement.id,
    );

    return {
      settlementIdHash:
        "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      transactionHash:
        "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
      blockNumber: 123456,
    };
  }

  async markReconciled(
    settlementId: string,
  ): Promise<RegistryReconciliationResult> {
    this.reconciledSettlementIds.push(
      settlementId,
    );

    return {
      settlementIdHash:
        "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      transactionHash:
        "0xcccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
      blockNumber: 123457,
    };
  }
}

class FailingRegistryClient implements SettlementRegistryGateway {
  async registerSettlement(
    _settlement: SettlementInstruction,
  ): Promise<RegistryRegistrationResult> {
    throw new Error(
      "Simulated registry failure",
    );
  }

  async markReconciled(
    _settlementId: string,
  ): Promise<RegistryReconciliationResult> {
    throw new Error(
      "Simulated reconciliation failure",
    );
  }
}

describe("SettlementOrchestrator", () => {
  it("executes and reconciles an approved settlement", async () => {
    const engine = new SettlementEngine();
    const ledger = new SettlementLedger();
    const executor = new SimulatedEvmExecutor();

    const orchestrator = new SettlementOrchestrator(
      engine,
      executor,
      ledger,
    );

    const settlementId =
      createApprovedSettlement(engine);

    const result =
      await orchestrator.executeApprovedSettlement(
        settlementId,
      );

    expect(
      result.settlement.status,
    ).toBe("RECONCILED");

    expect(
      result.transactionHash,
    ).toMatch(
      /^0x[a-fA-F0-9]{64}$/,
    );

    expect(
      ledger.has(settlementId),
    ).toBe(true);

    const ledgerEntry =
      ledger.get(settlementId);

    expect(
      ledgerEntry,
    ).toBeDefined();

    expect(
      ledgerEntry?.transactionHash,
    ).toBe(
      result.transactionHash,
    );

    expect(
      ledgerEntry?.assetSymbol,
    ).toBe("USDC");

    expect(
      ledgerEntry?.amount,
    ).toBe("100000.00");
  });

  it("rejects execution for an unknown settlement", async () => {
    const engine = new SettlementEngine();
    const ledger = new SettlementLedger();
    const executor = new SimulatedEvmExecutor();

    const orchestrator = new SettlementOrchestrator(
      engine,
      executor,
      ledger,
    );

    await expect(
      orchestrator.executeApprovedSettlement(
        "unknown-settlement",
      ),
    ).rejects.toThrow(
      "Settlement not found: unknown-settlement",
    );
  });

  it("rejects execution when settlement is not approved", async () => {
    const engine = new SettlementEngine();
    const ledger = new SettlementLedger();
    const executor = new SimulatedEvmExecutor();

    const orchestrator = new SettlementOrchestrator(
      engine,
      executor,
      ledger,
    );

    const settlement =
      engine.create(createInput());

    await expect(
      orchestrator.executeApprovedSettlement(
        settlement.id,
      ),
    ).rejects.toThrow(
      "Settlement must be APPROVED before execution: CREATED",
    );
  });

  it("marks the settlement as failed when execution fails", async () => {
    const engine = new SettlementEngine();
    const ledger = new SettlementLedger();
    const executor = new FailingExecutor();

    const orchestrator = new SettlementOrchestrator(
      engine,
      executor,
      ledger,
    );

    const settlementId =
      createApprovedSettlement(engine);

    await expect(
      orchestrator.executeApprovedSettlement(
        settlementId,
      ),
    ).rejects.toThrow(
      "Simulated execution failure",
    );

    const failed =
      engine.get(settlementId);

    expect(
      failed?.status,
    ).toBe("FAILED");

    expect(
      ledger.has(settlementId),
    ).toBe(false);
  });

  it("records exactly one ledger entry after successful execution", async () => {
    const engine = new SettlementEngine();
    const ledger = new SettlementLedger();
    const executor = new SimulatedEvmExecutor();

    const orchestrator = new SettlementOrchestrator(
      engine,
      executor,
      ledger,
    );

    const settlementId =
      createApprovedSettlement(engine);

    await orchestrator.executeApprovedSettlement(
      settlementId,
    );

    expect(
      ledger.list(),
    ).toHaveLength(1);
  });

  it("registers and reconciles a settlement on-chain when a registry client is provided", async () => {
    const engine = new SettlementEngine();
    const ledger = new SettlementLedger();
    const executor = new SimulatedEvmExecutor();
    const registry = new MockRegistryClient();

    const orchestrator = new SettlementOrchestrator(
      engine,
      executor,
      ledger,
      registry,
    );

    const settlementId =
      createApprovedSettlement(engine);

    const result =
      await orchestrator.executeApprovedSettlement(
        settlementId,
      );

    expect(
      result.settlement.status,
    ).toBe("RECONCILED");

    expect(
      registry.registeredSettlementIds,
    ).toEqual([
      settlementId,
    ]);

    expect(
      registry.reconciledSettlementIds,
    ).toEqual([
      settlementId,
    ]);

    expect(
      ledger.has(settlementId),
    ).toBe(true);
  });

  it("marks the settlement as failed when on-chain registration fails", async () => {
    const engine = new SettlementEngine();
    const ledger = new SettlementLedger();
    const executor = new SimulatedEvmExecutor();
    const registry =
      new FailingRegistryClient();

    const orchestrator = new SettlementOrchestrator(
      engine,
      executor,
      ledger,
      registry,
    );

    const settlementId =
      createApprovedSettlement(engine);

    await expect(
      orchestrator.executeApprovedSettlement(
        settlementId,
      ),
    ).rejects.toThrow(
      "Simulated registry failure",
    );

    const failed =
      engine.get(settlementId);

    expect(
      failed?.status,
    ).toBe("FAILED");

    expect(
      ledger.has(settlementId),
    ).toBe(false);
  });
});