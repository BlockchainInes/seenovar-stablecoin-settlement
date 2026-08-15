import { describe, expect, it } from "vitest";

import {
  ComplianceEngine,
  type CompliancePolicy,
} from "../src/compliance.js";
import { SettlementEngine } from "../src/settlement-engine.js";
import type { CreateSettlementInput } from "../src/settlement-engine.js";

const policy: CompliancePolicy = {
  blockedJurisdictions: ["KP", "IR"],
  maximumAutomaticAmount: 500000,
};

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
    amount: "250000.00",
    ...overrides,
  };
}

describe("ComplianceEngine", () => {
  it("approves a settlement that satisfies the policy", () => {
    const settlementEngine = new SettlementEngine();
    const complianceEngine = new ComplianceEngine(policy);

    const settlement = settlementEngine.create(createInput());
    const result = complianceEngine.evaluate(settlement);

    expect(result.decision).toBe("APPROVED");
    expect(result.reasons).toEqual([]);
    expect(result.checkedAt).toBeTruthy();
  });

  it("rejects a blocked sender jurisdiction", () => {
    const settlementEngine = new SettlementEngine();
    const complianceEngine = new ComplianceEngine(policy);

    const input = createInput({
      sender: {
        walletAddress: "0x1111111111111111111111111111111111111111",
        legalName: "Restricted Sender",
        jurisdiction: "KP",
      },
    });

    const settlement = settlementEngine.create(input);
    const result = complianceEngine.evaluate(settlement);

    expect(result.decision).toBe("REJECTED");
    expect(result.reasons).toContain(
      "Sender jurisdiction blocked: KP",
    );
  });

  it("rejects a blocked recipient jurisdiction", () => {
    const settlementEngine = new SettlementEngine();
    const complianceEngine = new ComplianceEngine(policy);

    const input = createInput({
      recipient: {
        walletAddress: "0x2222222222222222222222222222222222222222",
        legalName: "Restricted Recipient",
        jurisdiction: "IR",
      },
    });

    const settlement = settlementEngine.create(input);
    const result = complianceEngine.evaluate(settlement);

    expect(result.decision).toBe("REJECTED");
    expect(result.reasons).toContain(
      "Recipient jurisdiction blocked: IR",
    );
  });

  it("routes large settlements to manual review", () => {
    const settlementEngine = new SettlementEngine();
    const complianceEngine = new ComplianceEngine(policy);

    const settlement = settlementEngine.create(
      createInput({
        amount: "750000.00",
      }),
    );

    const result = complianceEngine.evaluate(settlement);

    expect(result.decision).toBe("MANUAL_REVIEW");
    expect(result.reasons).toContain(
      "Amount exceeds automatic approval threshold: 500000",
    );
  });

  it("rejects an invalid settlement amount", () => {
    const settlementEngine = new SettlementEngine();
    const complianceEngine = new ComplianceEngine(policy);

    const settlement = settlementEngine.create(
      createInput({
        amount: "-100.00",
      }),
    );

    const result = complianceEngine.evaluate(settlement);

    expect(result.decision).toBe("REJECTED");
    expect(result.reasons).toContain(
      "Settlement amount is invalid",
    );
  });
});