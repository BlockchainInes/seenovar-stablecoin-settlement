import { describe, expect, it } from "vitest";

import { SettlementEngine } from "../src/settlement-engine.js";
import type { CreateSettlementInput } from "../src/settlement-engine.js";

const settlementInput: CreateSettlementInput = {
  idempotencyKey: "settlement-001",
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
};

describe("SettlementEngine", () => {
  it("creates a settlement in CREATED state", () => {
    const engine = new SettlementEngine();

    const settlement = engine.create(settlementInput);

    expect(settlement.id).toBeTruthy();
    expect(settlement.status).toBe("CREATED");
    expect(settlement.amount).toBe("250000.00");
    expect(settlement.asset.symbol).toBe("USDC");
  });

  it("returns the same settlement for the same idempotency key", () => {
    const engine = new SettlementEngine();

    const first = engine.create(settlementInput);
    const second = engine.create(settlementInput);

    expect(second.id).toBe(first.id);
    expect(second).toEqual(first);
  });

  it("retrieves a settlement by id", () => {
    const engine = new SettlementEngine();

    const created = engine.create(settlementInput);
    const retrieved = engine.get(created.id);

    expect(retrieved).toEqual(created);
  });

  it("moves a settlement through valid lifecycle states", () => {
    const engine = new SettlementEngine();

    const created = engine.create(settlementInput);

    const compliancePending = engine.transition(
      created.id,
      "COMPLIANCE_PENDING",
    );

    const approved = engine.transition(
      created.id,
      "APPROVED",
    );

    const submitted = engine.transition(
      created.id,
      "SUBMITTED",
    );

    const confirmed = engine.transition(
      created.id,
      "CONFIRMED",
    );

    const reconciled = engine.transition(
      created.id,
      "RECONCILED",
    );

    expect(compliancePending.status).toBe("COMPLIANCE_PENDING");
    expect(approved.status).toBe("APPROVED");
    expect(submitted.status).toBe("SUBMITTED");
    expect(confirmed.status).toBe("CONFIRMED");
    expect(reconciled.status).toBe("RECONCILED");
  });

  it("rejects an invalid lifecycle transition", () => {
    const engine = new SettlementEngine();

    const created = engine.create(settlementInput);

    expect(() => {
      engine.transition(created.id, "CONFIRMED");
    }).toThrow(
      "Invalid settlement transition: CREATED -> CONFIRMED",
    );
  });

  it("rejects transitions for an unknown settlement", () => {
    const engine = new SettlementEngine();

    expect(() => {
      engine.transition("unknown-settlement", "COMPLIANCE_PENDING");
    }).toThrow(
      "Settlement not found: unknown-settlement",
    );
  });
});