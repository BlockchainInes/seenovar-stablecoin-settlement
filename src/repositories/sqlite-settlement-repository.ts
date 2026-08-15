import Database from "better-sqlite3";

import type {
  SettlementInstruction,
  SettlementStatus,
} from "../types.js";
import type { SettlementRepository } from "./settlement-repository.js";

interface SettlementRow {
  id: string;
  idempotency_key: string;
  sender_wallet: string;
  sender_legal_name: string;
  sender_jurisdiction: string;
  recipient_wallet: string;
  recipient_legal_name: string;
  recipient_jurisdiction: string;
  asset_symbol: string;
  asset_decimals: number;
  asset_chain_id: number;
  asset_contract_address: string;
  amount: string;
  status: SettlementStatus;
  transaction_hash: string | null;
  failure_reason: string | null;
  created_at: string;
  updated_at: string;
}

export class SqliteSettlementRepository
  implements SettlementRepository
{
  private readonly db: Database.Database;

  constructor(databasePath = "seenovar.db") {
    this.db = new Database(databasePath);

    this.db.pragma("journal_mode = WAL");
    this.db.pragma("foreign_keys = ON");

    this.initialize();
  }

  save(
    settlement: SettlementInstruction,
  ): SettlementInstruction {
    const statement = this.db.prepare(`
      INSERT INTO settlements (
        id,
        idempotency_key,
        sender_wallet,
        sender_legal_name,
        sender_jurisdiction,
        recipient_wallet,
        recipient_legal_name,
        recipient_jurisdiction,
        asset_symbol,
        asset_decimals,
        asset_chain_id,
        asset_contract_address,
        amount,
        status,
        transaction_hash,
        failure_reason,
        created_at,
        updated_at
      )
      VALUES (
        @id,
        @idempotencyKey,
        @senderWallet,
        @senderLegalName,
        @senderJurisdiction,
        @recipientWallet,
        @recipientLegalName,
        @recipientJurisdiction,
        @assetSymbol,
        @assetDecimals,
        @assetChainId,
        @assetContractAddress,
        @amount,
        @status,
        @transactionHash,
        @failureReason,
        @createdAt,
        @updatedAt
      )
      ON CONFLICT(id) DO UPDATE SET
        idempotency_key = excluded.idempotency_key,
        sender_wallet = excluded.sender_wallet,
        sender_legal_name = excluded.sender_legal_name,
        sender_jurisdiction = excluded.sender_jurisdiction,
        recipient_wallet = excluded.recipient_wallet,
        recipient_legal_name = excluded.recipient_legal_name,
        recipient_jurisdiction = excluded.recipient_jurisdiction,
        asset_symbol = excluded.asset_symbol,
        asset_decimals = excluded.asset_decimals,
        asset_chain_id = excluded.asset_chain_id,
        asset_contract_address = excluded.asset_contract_address,
        amount = excluded.amount,
        status = excluded.status,
        transaction_hash = excluded.transaction_hash,
        failure_reason = excluded.failure_reason,
        updated_at = excluded.updated_at
    `);

    statement.run({
      id: settlement.id,
      idempotencyKey: settlement.idempotencyKey,
      senderWallet: settlement.sender.walletAddress,
      senderLegalName: settlement.sender.legalName,
      senderJurisdiction: settlement.sender.jurisdiction,
      recipientWallet: settlement.recipient.walletAddress,
      recipientLegalName: settlement.recipient.legalName,
      recipientJurisdiction: settlement.recipient.jurisdiction,
      assetSymbol: settlement.asset.symbol,
      assetDecimals: settlement.asset.decimals,
      assetChainId: settlement.asset.chainId,
      assetContractAddress: settlement.asset.contractAddress,
      amount: settlement.amount,
      status: settlement.status,
      transactionHash: settlement.transactionHash ?? null,
      failureReason: settlement.failureReason ?? null,
      createdAt: settlement.createdAt,
      updatedAt: settlement.updatedAt,
    });

    return settlement;
  }

  findById(
    id: string,
  ): SettlementInstruction | undefined {
    const row = this.db
      .prepare(`
        SELECT *
        FROM settlements
        WHERE id = ?
      `)
      .get(id) as SettlementRow | undefined;

    return row
      ? this.mapRowToSettlement(row)
      : undefined;
  }

  findByIdempotencyKey(
    idempotencyKey: string,
  ): SettlementInstruction | undefined {
    const row = this.db
      .prepare(`
        SELECT *
        FROM settlements
        WHERE idempotency_key = ?
      `)
      .get(idempotencyKey) as SettlementRow | undefined;

    return row
      ? this.mapRowToSettlement(row)
      : undefined;
  }

  list(): SettlementInstruction[] {
    const rows = this.db
      .prepare(`
        SELECT *
        FROM settlements
        ORDER BY created_at ASC
      `)
      .all() as SettlementRow[];

    return rows.map((row) =>
      this.mapRowToSettlement(row),
    );
  }

  updateStatus(
    id: string,
    status: SettlementStatus,
  ): SettlementInstruction {
    const settlement = this.findById(id);

    if (!settlement) {
      throw new Error(
        `Settlement not found: ${id}`,
      );
    }

    const updated: SettlementInstruction = {
      ...settlement,
      status,
      updatedAt: new Date().toISOString(),
    };

    this.save(updated);

    return updated;
  }

  close(): void {
    this.db.close();
  }

  private initialize(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS settlements (
        id TEXT PRIMARY KEY,
        idempotency_key TEXT NOT NULL UNIQUE,
        sender_wallet TEXT NOT NULL,
        sender_legal_name TEXT NOT NULL,
        sender_jurisdiction TEXT NOT NULL,
        recipient_wallet TEXT NOT NULL,
        recipient_legal_name TEXT NOT NULL,
        recipient_jurisdiction TEXT NOT NULL,
        asset_symbol TEXT NOT NULL,
        asset_decimals INTEGER NOT NULL,
        asset_chain_id INTEGER NOT NULL,
        asset_contract_address TEXT NOT NULL,
        amount TEXT NOT NULL,
        status TEXT NOT NULL,
        transaction_hash TEXT,
        failure_reason TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_settlements_status
        ON settlements(status);

      CREATE INDEX IF NOT EXISTS idx_settlements_created_at
        ON settlements(created_at);
    `);
  }

  private mapRowToSettlement(
    row: SettlementRow,
  ): SettlementInstruction {
    if (row.asset_symbol !== "USDC") {
      throw new Error(
        `Unsupported asset in persistence layer: ${row.asset_symbol}`,
      );
    }

    if (row.asset_decimals !== 6) {
      throw new Error(
        `Unexpected asset decimals: ${row.asset_decimals}`,
      );
    }

    const settlement: SettlementInstruction = {
      id: row.id,
      idempotencyKey: row.idempotency_key,
      sender: {
        walletAddress: row.sender_wallet,
        legalName: row.sender_legal_name,
        jurisdiction: row.sender_jurisdiction,
      },
      recipient: {
        walletAddress: row.recipient_wallet,
        legalName: row.recipient_legal_name,
        jurisdiction: row.recipient_jurisdiction,
      },
      asset: {
        symbol: "USDC",
        decimals: 6,
        chainId: row.asset_chain_id,
        contractAddress: row.asset_contract_address,
      },
      amount: row.amount,
      status: row.status,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };

    if (row.transaction_hash !== null) {
      settlement.transactionHash =
        row.transaction_hash;
    }

    if (row.failure_reason !== null) {
      settlement.failureReason =
        row.failure_reason;
    }

    return settlement;
  }
}