import { describe, expect, it } from "vitest";

import { SettlementLedger } from "../src/ledger.js";
import type { SettlementInstruction } from "../src/types.js";

function createConfirmedSettlement(): SettlementInstruction {
  return {
    id: "settlement-ledger-001",
    idempotencyKey: "idem-ledger-001",
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
    status: "CONFIRMED",
    createdAt: "2026-08-15T12:00:00.000Z",
    updatedAt: "2026-08-15T12:05:00.000Z",
  };
}

describe("SettlementLedger", () => {
  it("records a confirmed settlement", () => {
    const ledger = new SettlementLedger();
    const settlement = createConfirmedSettlement();

    const entry = ledger.record(
      settlement,
      "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    );

    expect(entry.settlementId).toBe(settlement.id);
    expect(entry.assetSymbol).toBe("USDC");
    expect(entry.amount).toBe("100000.00");
    expect(entry.chainId).toBe(1);
    expect(ledger.has(settlement.id)).toBe(true);
  });

  it("rejects a settlement that is not confirmed", () => {
    const ledger = new SettlementLedger();

    const settlement: SettlementInstruction = {
      ...createConfirmedSettlement(),
      status: "APPROVED",
    };

    expect(() =>
      ledger.record(
        settlement,
        "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
      ),
    ).toThrow(
      "Settlement must be CONFIRMED before ledger recording: APPROVED",
    );
  });

  it("prevents duplicate ledger entries", () => {
    const ledger = new SettlementLedger();
    const settlement = createConfirmedSettlement();

    const first = ledger.record(
      settlement,
      "0xcccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
    );

    const second = ledger.record(
      settlement,
      "0xdddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd",
    );

    expect(second).toBe(first);
    expect(ledger.list()).toHaveLength(1);
    expect(second.transactionHash).toBe(first.transactionHash);
  });

  it("retrieves a ledger entry by settlement id", () => {
    const ledger = new SettlementLedger();
    const settlement = createConfirmedSettlement();

    const recorded = ledger.record(
      settlement,
      "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee",
    );

    expect(ledger.get(settlement.id)).toEqual(recorded);
  });

  it("returns all recorded ledger entries", () => {
    const ledger = new SettlementLedger();

    const first = createConfirmedSettlement();

    const second: SettlementInstruction = {
      ...createConfirmedSettlement(),
      id: "settlement-ledger-002",
      idempotencyKey: "idem-ledger-002",
    };

    ledger.record(
      first,
      "0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff",
    );

    ledger.record(
      second,
      "0x9999999999999999999999999999999999999999999999999999999999999999",
    );

    expect(ledger.list()).toHaveLength(2);
  });
});