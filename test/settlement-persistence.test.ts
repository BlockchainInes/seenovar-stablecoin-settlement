import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
} from "vitest";

import { SqliteSettlementRepository } from "../src/repositories/sqlite-settlement-repository.js";
import { SettlementEngine } from "../src/settlement-engine.js";

describe("Settlement persistence", () => {
  let repository: SqliteSettlementRepository;

  beforeEach(() => {
    repository =
      new SqliteSettlementRepository(":memory:");
  });

  afterEach(() => {
    repository.close();
  });

  it("restores a settlement in a new engine instance", () => {
    const firstEngine =
      new SettlementEngine(repository);

    const created = firstEngine.create({
      idempotencyKey: "restart-test-001",
      sender: {
        walletAddress:
          "0x1111111111111111111111111111111111111111",
        legalName: "Seenovar Treasury Europe",
        jurisdiction: "FR",
      },
      recipient: {
        walletAddress:
          "0x2222222222222222222222222222222222222222",
        legalName: "Institutional Counterparty",
        jurisdiction: "DE",
      },
      asset: {
        symbol: "USDC",
        decimals: 6,
        chainId: 1,
        contractAddress:
          "0xA0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
      },
      amount: "100000.00",
    });

    firstEngine.transition(
      created.id,
      "COMPLIANCE_PENDING",
    );

    firstEngine.transition(
      created.id,
      "APPROVED",
    );

    const secondEngine =
      new SettlementEngine(repository);

    const restored =
      secondEngine.get(created.id);

    expect(restored).toBeDefined();
    expect(restored?.id).toBe(created.id);
    expect(restored?.status).toBe("APPROVED");
    expect(restored?.amount).toBe("100000.00");
    expect(restored?.asset.symbol).toBe("USDC");
    expect(restored?.sender.jurisdiction).toBe("FR");
    expect(restored?.recipient.jurisdiction).toBe("DE");
  });

  it("preserves idempotency across engine instances", () => {
    const firstEngine =
      new SettlementEngine(repository);

    const input = {
      idempotencyKey: "restart-idempotency-001",
      sender: {
        walletAddress:
          "0x1111111111111111111111111111111111111111",
        legalName: "Seenovar Treasury Europe",
        jurisdiction: "FR",
      },
      recipient: {
        walletAddress:
          "0x2222222222222222222222222222222222222222",
        legalName: "Institutional Counterparty",
        jurisdiction: "DE",
      },
      asset: {
        symbol: "USDC" as const,
        decimals: 6 as const,
        chainId: 1,
        contractAddress:
          "0xA0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
      },
      amount: "250000.00",
    };

    const original =
      firstEngine.create(input);

    const secondEngine =
      new SettlementEngine(repository);

    const duplicate =
      secondEngine.create(input);

    expect(duplicate.id).toBe(original.id);

    expect(
      repository.list(),
    ).toHaveLength(1);
  });
});