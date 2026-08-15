import { describe, expect, it } from "vitest";

import {
  ComplianceEngine,
  type CompliancePolicy,
} from "../src/compliance.js";
import {
  SettlementEngine,
  type CreateSettlementInput,
} from "../src/settlement-engine.js";
import { SettlementService } from "../src/settlement-service.js";

const policy: CompliancePolicy = {
  blockedJurisdictions: ["KP", "IR"],
  maximumAutomaticAmount: 500000,
};

function createService(): SettlementService {
  const settlementEngine = new SettlementEngine();
  const complianceEngine = new ComplianceEngine(policy);

  return new SettlementService(
    settlementEngine,
    complianceEngine,
  );
}

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

describe("SettlementService", () => {
  it("approves a compliant settlement", () => {
    const service = createService();

    const result = service.createAndEvaluate(
      createInput(),
    );

    expect(result.compliance.decision).toBe("APPROVED");
    expect(result.settlement.status).toBe("APPROVED");
  });

  it("fails a settlement rejected by compliance", () => {
    const service = createService();

    const result = service.createAndEvaluate(
      createInput({
        recipient: {
          walletAddress: "0x2222222222222222222222222222222222222222",
          legalName: "Restricted Counterparty",
          jurisdiction: "IR",
        },
      }),
    );

    expect(result.compliance.decision).toBe("REJECTED");
    expect(result.settlement.status).toBe("FAILED");
  });

  it("keeps a settlement pending when manual review is required", () => {
    const service = createService();

    const result = service.createAndEvaluate(
      createInput({
        amount: "750000.00",
      }),
    );

    expect(result.compliance.decision).toBe("MANUAL_REVIEW");
    expect(result.settlement.status).toBe("COMPLIANCE_PENDING");
  });

  it("preserves idempotency across repeated requests", () => {
    const service = createService();

    const input = createInput({
      idempotencyKey: "idem-settlement-001",
    });

    const first = service.createAndEvaluate(input);
    const second = service.createAndEvaluate(input);

    expect(second.settlement.id).toBe(first.settlement.id);
    expect(second.settlement.status).toBe("APPROVED");
  });
});