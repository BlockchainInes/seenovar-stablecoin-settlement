import type { SettlementInstruction } from "./types.js";

export interface LedgerEntry {
  settlementId: string;
  transactionHash: string;
  assetSymbol: string;
  amount: string;
  senderWallet: string;
  recipientWallet: string;
  chainId: number;
  recordedAt: string;
}

export class SettlementLedger {
  private readonly entries = new Map<string, LedgerEntry>();

  record(
    settlement: SettlementInstruction,
    transactionHash: string,
  ): LedgerEntry {
    if (settlement.status !== "CONFIRMED") {
      throw new Error(
        `Settlement must be CONFIRMED before ledger recording: ${settlement.status}`,
      );
    }

    const existing = this.entries.get(settlement.id);

    if (existing) {
      return existing;
    }

    const entry: LedgerEntry = {
      settlementId: settlement.id,
      transactionHash,
      assetSymbol: settlement.asset.symbol,
      amount: settlement.amount,
      senderWallet: settlement.sender.walletAddress,
      recipientWallet: settlement.recipient.walletAddress,
      chainId: settlement.asset.chainId,
      recordedAt: new Date().toISOString(),
    };

    this.entries.set(settlement.id, entry);

    return entry;
  }

  get(settlementId: string): LedgerEntry | undefined {
    return this.entries.get(settlementId);
  }

  has(settlementId: string): boolean {
    return this.entries.has(settlementId);
  }

  list(): LedgerEntry[] {
    return Array.from(this.entries.values());
  }
}