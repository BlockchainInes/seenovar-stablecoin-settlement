import { describe, expect, it } from "vitest";

import { buildApp } from "../src/app.js";

const validBody = {
  idempotencyKey: "api-settlement-001",
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

describe("POST /settlements", () => {
  it("creates and approves a compliant settlement", async () => {
    const app = buildApp();

    const response = await app.inject({
      method: "POST",
      url: "/settlements",
      payload: validBody,
    });

    expect(response.statusCode).toBe(201);

    const body = response.json();

    expect(body.settlement.status).toBe("APPROVED");
    expect(body.compliance.decision).toBe("APPROVED");

    await app.close();
  });

  it("fails a settlement with a blocked jurisdiction", async () => {
    const app = buildApp();

    const response = await app.inject({
      method: "POST",
      url: "/settlements",
      payload: {
        ...validBody,
        idempotencyKey: "api-settlement-002",
        recipient: {
          ...validBody.recipient,
          jurisdiction: "IR",
        },
      },
    });

    expect(response.statusCode).toBe(201);

    const body = response.json();

    expect(body.settlement.status).toBe("FAILED");
    expect(body.compliance.decision).toBe("REJECTED");

    await app.close();
  });

  it("keeps a high-value settlement pending manual review", async () => {
    const app = buildApp();

    const response = await app.inject({
      method: "POST",
      url: "/settlements",
      payload: {
        ...validBody,
        idempotencyKey: "api-settlement-003",
        amount: "750000.00",
      },
    });

    expect(response.statusCode).toBe(201);

    const body = response.json();

    expect(body.settlement.status).toBe("COMPLIANCE_PENDING");
    expect(body.compliance.decision).toBe("MANUAL_REVIEW");

    await app.close();
  });

  it("preserves idempotency for duplicate requests", async () => {
    const app = buildApp();

    const firstResponse = await app.inject({
      method: "POST",
      url: "/settlements",
      payload: {
        ...validBody,
        idempotencyKey: "api-settlement-004",
      },
    });

    const secondResponse = await app.inject({
      method: "POST",
      url: "/settlements",
      payload: {
        ...validBody,
        idempotencyKey: "api-settlement-004",
      },
    });

    expect(firstResponse.statusCode).toBe(201);
    expect(secondResponse.statusCode).toBe(201);

    const firstBody = firstResponse.json();
    const secondBody = secondResponse.json();

    expect(secondBody.settlement.id).toBe(firstBody.settlement.id);

    await app.close();
  });

  it("rejects an invalid amount", async () => {
    const app = buildApp();

    const response = await app.inject({
      method: "POST",
      url: "/settlements",
      payload: {
        ...validBody,
        idempotencyKey: "api-settlement-invalid-amount",
        amount: "potatoe",
      },
    });

    expect(response.statusCode).toBe(400);

    await app.close();
  });

  it("rejects an invalid sender wallet address", async () => {
    const app = buildApp();

    const response = await app.inject({
      method: "POST",
      url: "/settlements",
      payload: {
        ...validBody,
        idempotencyKey: "api-settlement-invalid-wallet",
        sender: {
          ...validBody.sender,
          walletAddress: "0x1234",
        },
      },
    });

    expect(response.statusCode).toBe(400);

    await app.close();
  });

  it("rejects unexpected request properties", async () => {
    const app = buildApp();

    const response = await app.inject({
      method: "POST",
      url: "/settlements",
      payload: {
        ...validBody,
        idempotencyKey: "api-settlement-extra-property",
        unexpectedField: "not-allowed",
      },
    });

    expect(response.statusCode).toBe(400);

    await app.close();
  });
});