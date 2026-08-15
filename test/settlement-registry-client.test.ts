import { describe, expect, it } from "vitest";
import { keccak256, toUtf8Bytes } from "ethers";

import { SettlementRegistryClient } from "../src/blockchain/settlement-registry-client.js";

describe("SettlementRegistryClient", () => {
  it("creates a deterministic settlement id hash", () => {
    const client = new SettlementRegistryClient(
      "http://127.0.0.1:8545",
      "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      "0x1111111111111111111111111111111111111111",
    );

    const settlementId = "settlement-001";

    const expectedHash = keccak256(
      toUtf8Bytes(settlementId),
    );

    expect(
      client.hashSettlementId(settlementId),
    ).toBe(expectedHash);

    expect(
      client.hashSettlementId(settlementId),
    ).toBe(
      client.hashSettlementId(settlementId),
    );
  });

  it("produces different hashes for different settlement ids", () => {
    const client = new SettlementRegistryClient(
      "http://127.0.0.1:8545",
      "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      "0x1111111111111111111111111111111111111111",
    );

    const first =
      client.hashSettlementId(
        "settlement-001",
      );

    const second =
      client.hashSettlementId(
        "settlement-002",
      );

    expect(first).not.toBe(second);
  });

  it("rejects a missing RPC URL", () => {
    expect(
      () =>
        new SettlementRegistryClient(
          "",
          "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
          "0x1111111111111111111111111111111111111111",
        ),
    ).toThrow(
      "SEPOLIA_RPC_URL is required",
    );
  });

  it("rejects a missing private key", () => {
    expect(
      () =>
        new SettlementRegistryClient(
          "http://127.0.0.1:8545",
          "",
          "0x1111111111111111111111111111111111111111",
        ),
    ).toThrow(
      "PRIVATE_KEY is required",
    );
  });

  it("rejects a missing registry address", () => {
    expect(
      () =>
        new SettlementRegistryClient(
          "http://127.0.0.1:8545",
          "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
          "",
        ),
    ).toThrow(
      "SEENOVAR_REGISTRY_ADDRESS is required",
    );
  });
});