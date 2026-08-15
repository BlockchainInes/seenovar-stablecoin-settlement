import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { SqliteSettlementRepository } from "../src/repositories/sqlite-settlement-repository.js";
import type { SettlementInstruction } from "../src/types.js";

function createSettlement(
  overrides: Partial<SettlementInstruction> = {},
): SettlementInstruction {
  const now = new Date().toISOString();

  return {
    id: crypto.randomUUID(),
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
    status: "CREATED",
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

describe("SqliteSettlementRepository", () => {
  let repository: SqliteSettlementRepository;

  beforeEach(() => {
    repository = new SqliteSettlementRepository(":memory:");
  });

  afterEach(() => {
    repository.close();
  });

  it("saves and retrieves a settlement", () => {
    const settlement = createSettlement();

    repository.save(settlement);

    const stored = repository.findById(settlement.id);

    expect(stored).toEqual(settlement);
  });

  it("retrieves a settlement by idempotency key", () => {
    const settlement = createSettlement({
      idempotencyKey: "persistent-payment-001",
    });

    repository.save(settlement);

    const stored = repository.findByIdempotencyKey(
      "persistent-payment-001",
    );

    expect(stored).toEqual(settlement);
  });

  it("lists stored settlements", () => {
    const first = createSettlement({
      idempotencyKey: "persistent-payment-001",
    });

    const second = createSettlement({
      idempotencyKey: "persistent-payment-002",
    });

    repository.save(first);
    repository.save(second);

    const settlements = repository.list();

    expect(settlements).toHaveLength(2);

    expect(
      settlements.map((settlement) => settlement.id),
    ).toContain(first.id);

    expect(
      settlements.map((settlement) => settlement.id),
    ).toContain(second.id);
  });

  it("updates settlement status", () => {
    const settlement = createSettlement();

    repository.save(settlement);

    const updated = repository.updateStatus(
      settlement.id,
      "COMPLIANCE_PENDING",
    );

    expect(updated.status).toBe("COMPLIANCE_PENDING");

    const stored = repository.findById(
      settlement.id,
    );

    expect(stored?.status).toBe(
      "COMPLIANCE_PENDING",
    );
  });

  it("persists optional transaction data", () => {
    const settlement = createSettlement({
      status: "CONFIRMED",
      transactionHash:
        "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    });

    repository.save(settlement);

    const stored = repository.findById(
      settlement.id,
    );

    expect(stored?.transactionHash).toBe(
      settlement.transactionHash,
    );
  });

  it("updates an existing settlement without creating a duplicate", () => {
    const settlement = createSettlement();

    repository.save(settlement);

    repository.save({
      ...settlement,
      status: "APPROVED",
      updatedAt: new Date().toISOString(),
    });

    const settlements = repository.list();

    expect(settlements).toHaveLength(1);
    expect(settlements[0]?.status).toBe("APPROVED");
  });

  it("throws when updating an unknown settlement", () => {
    expect(() =>
      repository.updateStatus(
        "unknown-settlement",
        "FAILED",
      ),
    ).toThrow(
      "Settlement not found: unknown-settlement",
    );
  });
});
