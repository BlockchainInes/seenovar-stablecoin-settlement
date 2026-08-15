import type {
  RegistryReconciliationResult,
  RegistryRegistrationResult,
} from "./blockchain/settlement-registry-client.js";
import type { StablecoinExecutor } from "./execution.js";
import { SettlementLedger } from "./ledger.js";
import { SettlementEngine } from "./settlement-engine.js";
import type { SettlementInstruction } from "./types.js";

export interface SettlementRegistryGateway {
  registerSettlement(
    settlement: SettlementInstruction,
  ): Promise<RegistryRegistrationResult>;

  markReconciled(
    settlementId: string,
  ): Promise<RegistryReconciliationResult>;
}

export interface SettlementExecutionResult {
  settlement: SettlementInstruction;
  transactionHash: string;
  registryRegistration?: RegistryRegistrationResult;
  registryReconciliation?: RegistryReconciliationResult;
}

export class SettlementOrchestrator {
  constructor(
    private readonly settlementEngine: SettlementEngine,
    private readonly executor: StablecoinExecutor,
    private readonly ledger: SettlementLedger,
    private readonly registryClient?: SettlementRegistryGateway,
  ) {}

  async executeApprovedSettlement(
    settlementId: string,
  ): Promise<SettlementExecutionResult> {
    const settlement =
      this.settlementEngine.get(settlementId);

    if (!settlement) {
      throw new Error(
        `Settlement not found: ${settlementId}`,
      );
    }

    if (settlement.status !== "APPROVED") {
      throw new Error(
        `Settlement must be APPROVED before execution: ${settlement.status}`,
      );
    }

    const submitted =
      this.settlementEngine.transition(
        settlement.id,
        "SUBMITTED",
      );

    try {
      const execution =
        await this.executor.execute({
          settlementId: submitted.id,
          chainId: submitted.asset.chainId,
          tokenAddress:
            submitted.asset.contractAddress,
          senderWallet:
            submitted.sender.walletAddress,
          recipientWallet:
            submitted.recipient.walletAddress,
          amount: submitted.amount,
          assetSymbol: submitted.asset.symbol,
        });

      const confirmed =
        this.settlementEngine.transition(
          submitted.id,
          "CONFIRMED",
        );

      const confirmedWithHash:
        SettlementInstruction = {
          ...confirmed,
          transactionHash:
            execution.transactionHash,
          updatedAt:
            new Date().toISOString(),
        };

      let registryRegistration:
        RegistryRegistrationResult | undefined;

      let registryReconciliation:
        RegistryReconciliationResult | undefined;

      if (this.registryClient) {
        registryRegistration =
          await this.registryClient.registerSettlement(
            confirmedWithHash,
          );
      }

      this.ledger.record(
        confirmedWithHash,
        execution.transactionHash,
      );

      if (this.registryClient) {
        registryReconciliation =
          await this.registryClient.markReconciled(
            confirmedWithHash.id,
          );
      }

      const reconciled =
        this.settlementEngine.transition(
          confirmedWithHash.id,
          "RECONCILED",
        );

      const reconciledWithHash:
        SettlementInstruction = {
          ...reconciled,
          transactionHash:
            execution.transactionHash,
        };

      const result: SettlementExecutionResult = {
        settlement: reconciledWithHash,
        transactionHash:
          execution.transactionHash,
      };

      if (registryRegistration) {
        result.registryRegistration =
          registryRegistration;
      }

      if (registryReconciliation) {
        result.registryReconciliation =
          registryReconciliation;
      }

      return result;
    } catch (error) {
      const current =
        this.settlementEngine.get(
          settlement.id,
        );

      if (
        current &&
        current.status !== "FAILED" &&
        current.status !== "RECONCILED"
      ) {
        this.settlementEngine.transition(
          current.id,
          "FAILED",
        );
      }

      throw error;
    }
  }
}