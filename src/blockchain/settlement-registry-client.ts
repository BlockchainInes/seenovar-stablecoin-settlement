import {
  Contract,
  JsonRpcProvider,
  Wallet,
  keccak256,
  parseUnits,
  toUtf8Bytes,
} from "ethers";

import type { SettlementInstruction } from "../types.js";

const REGISTRY_ABI = [
  "function registerSettlement(bytes32 settlementIdHash, bytes32 transactionHash, uint256 chainId, uint256 amountMinorUnits, address asset, address senderWallet, address recipientWallet)",
  "function markReconciled(bytes32 settlementIdHash)",
  "function exists(bytes32 settlementIdHash) view returns (bool)",
  "function isReconciled(bytes32 settlementIdHash) view returns (bool)",
] as const;

export interface RegistryRegistrationResult {
  settlementIdHash: string;
  transactionHash: string;
  blockNumber: number;
}

export interface RegistryReconciliationResult {
  settlementIdHash: string;
  transactionHash: string;
  blockNumber: number;
}

export class SettlementRegistryClient {
  private readonly contract: Contract;

  constructor(
    rpcUrl: string,
    privateKey: string,
    registryAddress: string,
  ) {
    if (!rpcUrl) {
      throw new Error("SEPOLIA_RPC_URL is required");
    }

    if (!privateKey) {
      throw new Error("PRIVATE_KEY is required");
    }

    if (!registryAddress) {
      throw new Error(
        "SEENOVAR_REGISTRY_ADDRESS is required",
      );
    }

    const provider =
      new JsonRpcProvider(rpcUrl);

    const signer =
      new Wallet(privateKey, provider);

    this.contract = new Contract(
      registryAddress,
      REGISTRY_ABI,
      signer,
    );
  }

  async registerSettlement(
    settlement: SettlementInstruction,
  ): Promise<RegistryRegistrationResult> {
    if (!settlement.transactionHash) {
      throw new Error(
        "Settlement transaction hash is required",
      );
    }

    const settlementIdHash =
      this.hashSettlementId(settlement.id);

    const existsFunction =
      this.contract.getFunction("exists");

    const alreadyExists =
      await existsFunction(
        settlementIdHash,
      );

    if (alreadyExists) {
      throw new Error(
        `Settlement already registered on-chain: ${settlement.id}`,
      );
    }

    const amountMinorUnits =
      parseUnits(
        settlement.amount,
        settlement.asset.decimals,
      );

    const registerFunction =
      this.contract.getFunction(
        "registerSettlement",
      );

    const transaction =
      await registerFunction(
        settlementIdHash,
        settlement.transactionHash,
        BigInt(settlement.asset.chainId),
        amountMinorUnits,
        settlement.asset.contractAddress,
        settlement.sender.walletAddress,
        settlement.recipient.walletAddress,
      );

    const receipt =
      await transaction.wait();

    if (!receipt) {
      throw new Error(
        "Registry transaction was not confirmed",
      );
    }

    return {
      settlementIdHash,
      transactionHash: transaction.hash,
      blockNumber: receipt.blockNumber,
    };
  }

  async markReconciled(
    settlementId: string,
  ): Promise<RegistryReconciliationResult> {
    const settlementIdHash =
      this.hashSettlementId(settlementId);

    const existsFunction =
      this.contract.getFunction("exists");

    const exists =
      await existsFunction(
        settlementIdHash,
      );

    if (!exists) {
      throw new Error(
        `Settlement is not registered on-chain: ${settlementId}`,
      );
    }

    const isReconciledFunction =
      this.contract.getFunction(
        "isReconciled",
      );

    const reconciled =
      await isReconciledFunction(
        settlementIdHash,
      );

    if (reconciled) {
      throw new Error(
        `Settlement is already reconciled on-chain: ${settlementId}`,
      );
    }

    const markReconciledFunction =
      this.contract.getFunction(
        "markReconciled",
      );

    const transaction =
      await markReconciledFunction(
        settlementIdHash,
      );

    const receipt =
      await transaction.wait();

    if (!receipt) {
      throw new Error(
        "Reconciliation transaction was not confirmed",
      );
    }

    return {
      settlementIdHash,
      transactionHash: transaction.hash,
      blockNumber: receipt.blockNumber,
    };
  }

  async exists(
    settlementId: string,
  ): Promise<boolean> {
    const existsFunction =
      this.contract.getFunction("exists");

    return Boolean(
      await existsFunction(
        this.hashSettlementId(settlementId),
      ),
    );
  }

  async isReconciled(
    settlementId: string,
  ): Promise<boolean> {
    const isReconciledFunction =
      this.contract.getFunction(
        "isReconciled",
      );

    return Boolean(
      await isReconciledFunction(
        this.hashSettlementId(settlementId),
      ),
    );
  }

  hashSettlementId(
    settlementId: string,
  ): string {
    return keccak256(
      toUtf8Bytes(settlementId),
    );
  }
}