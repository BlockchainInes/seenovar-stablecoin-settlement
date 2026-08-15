import { describe, expect, it } from "vitest";

import { buildApp } from "../src/app.js";

const validBody = {
  idempotencyKey: "execute-api-001",
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
    symbol: "USDC" as const,
    decimals: 6 as const,
    chainId: 1,
    contractAddress: "0xA0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
  },
  amount: "100000.00",
};

describe("POST /settlements/:id/execute", () => {
  it("executes and reconciles an approved settlement", async () => {
    const app = buildApp();

    const createResponse = await app.inject({
      method: "POST",
      url: "/settlements",
      payload: {
        ...validBody,
        idempotencyKey: "execute-api-approved",
      },
    });

    expect(createResponse.statusCode).toBe(201);

    const created = createResponse.json();

    expect(created.settlement.status).toBe("APPROVED");

    const executeResponse = await app.inject({
      method: "POST",
      url: `/settlements/${created.settlement.id}/execute`,
    });

    expect(executeResponse.statusCode).toBe(200);

    const executed = executeResponse.json();

    expect(executed.settlement.status).toBe("RECONCILED");
    expect(executed.transactionHash).toMatch(
      /^0x[a-fA-F0-9]{64}$/,
    );

    expect(executed.ledgerEntry).toBeDefined();
    expect(executed.ledgerEntry.settlementId).toBe(
      created.settlement.id,
    );
    expect(executed.ledgerEntry.assetSymbol).toBe("USDC");
    expect(executed.ledgerEntry.amount).toBe("100000.00");

    await app.close();
  });

  it("returns 404 for an unknown settlement", async () => {
    const app = buildApp();

    const response = await app.inject({
      method: "POST",
      url: "/settlements/unknown-settlement/execute",
    });

    expect(response.statusCode).toBe(404);

    const body = response.json();

    expect(body.error).toBe("SETTLEMENT_NOT_FOUND");
    expect(body.message).toBe(
      "Settlement not found: unknown-settlement",
    );

    await app.close();
  });

  it("returns 409 when a settlement is not approved", async () => {
    const app = buildApp();

    const createResponse = await app.inject({
      method: "POST",
      url: "/settlements",
      payload: {
        ...validBody,
        idempotencyKey: "execute-api-manual-review",
        amount: "750000.00",
      },
    });

    expect(createResponse.statusCode).toBe(201);

    const created = createResponse.json();

    expect(created.settlement.status).toBe(
      "COMPLIANCE_PENDING",
    );

    const executeResponse = await app.inject({
      method: "POST",
      url: `/settlements/${created.settlement.id}/execute`,
    });

    expect(executeResponse.statusCode).toBe(409);

    const body = executeResponse.json();

    expect(body.error).toBe(
      "SETTLEMENT_NOT_EXECUTABLE",
    );

    expect(body.message).toBe(
      "Settlement must be APPROVED before execution: COMPLIANCE_PENDING",
    );

    await app.close();
  });

  it("returns 409 when a rejected settlement is executed", async () => {
    const app = buildApp();

    const createResponse = await app.inject({
      method: "POST",
      url: "/settlements",
      payload: {
        ...validBody,
        idempotencyKey: "execute-api-rejected",
        recipient: {
          ...validBody.recipient,
          jurisdiction: "IR",
        },
      },
    });

    expect(createResponse.statusCode).toBe(201);

    const created = createResponse.json();

    expect(created.settlement.status).toBe("FAILED");

    const executeResponse = await app.inject({
      method: "POST",
      url: `/settlements/${created.settlement.id}/execute`,
    });

    expect(executeResponse.statusCode).toBe(409);

    const body = executeResponse.json();

    expect(body.error).toBe(
      "SETTLEMENT_NOT_EXECUTABLE",
    );

    expect(body.message).toBe(
      "Settlement must be APPROVED before execution: FAILED",
    );

    await app.close();
  });
});