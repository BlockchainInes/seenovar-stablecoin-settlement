import { describe, expect, it } from "vitest";

import {
  SimulatedEvmExecutor,
  type StablecoinTransferRequest,
} from "../src/execution.js";

function createRequest(
  overrides: Partial<StablecoinTransferRequest> = {},
): StablecoinTransferRequest {
  return {
    settlementId: "settlement-execution-001",
    chainId: 1,
    tokenAddress: "0xA0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
    senderWallet: "0x1111111111111111111111111111111111111111",
    recipientWallet: "0x2222222222222222222222222222222222222222",
    amount: "100000.00",
    assetSymbol: "USDC",
    ...overrides,
  };
}

describe("SimulatedEvmExecutor", () => {
  it("executes a valid USDC transfer", async () => {
    const executor = new SimulatedEvmExecutor();

    const result = await executor.execute(createRequest());

    expect(result.settlementId).toBe("settlement-execution-001");
    expect(result.chainId).toBe(1);
    expect(result.status).toBe("CONFIRMED");
    expect(result.transactionHash).toMatch(/^0x[a-fA-F0-9]{64}$/);
    expect(result.submittedAt).toBeDefined();
    expect(result.confirmedAt).toBeDefined();
  });

  it("rejects an unsupported stablecoin", async () => {
    const executor = new SimulatedEvmExecutor();

    await expect(
      executor.execute(
        createRequest({
          assetSymbol: "POTATOE",
        }),
      ),
    ).rejects.toThrow("Unsupported stablecoin: POTATOE");
  });

  it("rejects an invalid chain ID", async () => {
    const executor = new SimulatedEvmExecutor();

    await expect(
      executor.execute(
        createRequest({
          chainId: 0,
        }),
      ),
    ).rejects.toThrow("Invalid chain ID");
  });

  it("rejects an invalid token address", async () => {
    const executor = new SimulatedEvmExecutor();

    await expect(
      executor.execute(
        createRequest({
          tokenAddress: "0x1234",
        }),
      ),
    ).rejects.toThrow("Invalid token address");
  });

  it("rejects an invalid sender wallet", async () => {
    const executor = new SimulatedEvmExecutor();

    await expect(
      executor.execute(
        createRequest({
          senderWallet: "0x1234",
        }),
      ),
    ).rejects.toThrow("Invalid sender wallet");
  });

  it("rejects an invalid recipient wallet", async () => {
    const executor = new SimulatedEvmExecutor();

    await expect(
      executor.execute(
        createRequest({
          recipientWallet: "0x1234",
        }),
      ),
    ).rejects.toThrow("Invalid recipient wallet");
  });

  it("rejects an invalid transfer amount", async () => {
    const executor = new SimulatedEvmExecutor();

    await expect(
      executor.execute(
        createRequest({
          amount: "potatoe",
        }),
      ),
    ).rejects.toThrow("Invalid transfer amount");
  });

  it("rejects a zero transfer amount", async () => {
    const executor = new SimulatedEvmExecutor();

    await expect(
      executor.execute(
        createRequest({
          amount: "0",
        }),
      ),
    ).rejects.toThrow(
      "Transfer amount must be greater than zero",
    );
  });

  it("produces a deterministic transaction hash", async () => {
    const executor = new SimulatedEvmExecutor();

    const first = await executor.execute(createRequest());
    const second = await executor.execute(createRequest());

    expect(second.transactionHash).toBe(first.transactionHash);
  });
});