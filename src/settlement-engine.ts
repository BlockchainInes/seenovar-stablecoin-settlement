import { randomUUID } from "node:crypto";

import type { SettlementRepository } from "./repositories/settlement-repository.js";
import { assertTransition } from "./settlement-state.js";
import type {
  SettlementInstruction,
  SettlementParty,
  SettlementStatus,
  StablecoinAsset,
} from "./types.js";

export interface CreateSettlementInput {
  idempotencyKey: string;
  sender: SettlementParty;
  recipient: SettlementParty;
  asset: StablecoinAsset;
  amount: string;
}

export class SettlementEngine {
  private readonly settlements = new Map<string, SettlementInstruction>();
  private readonly idempotencyIndex = new Map<string, string>();

  constructor(
    private readonly repository?: SettlementRepository,
  ) {}

  create(input: CreateSettlementInput): SettlementInstruction {
    const persisted =
      this.repository?.findByIdempotencyKey(
        input.idempotencyKey,
      );

    if (persisted) {
      this.cache(persisted);
      return persisted;
    }

    const existingId = this.idempotencyIndex.get(
      input.idempotencyKey,
    );

    if (existingId) {
      const existing = this.settlements.get(existingId);

      if (!existing) {
        throw new Error("Settlement index is inconsistent");
      }

      return existing;
    }

    const now = new Date().toISOString();

    const settlement: SettlementInstruction = {
      id: randomUUID(),
      idempotencyKey: input.idempotencyKey,
      sender: input.sender,
      recipient: input.recipient,
      asset: input.asset,
      amount: input.amount,
      status: "CREATED",
      createdAt: now,
      updatedAt: now,
    };

    this.cache(settlement);
    this.repository?.save(settlement);

    return settlement;
  }

  get(id: string): SettlementInstruction | undefined {
    const cached = this.settlements.get(id);

    if (cached) {
      return cached;
    }

    const persisted = this.repository?.findById(id);

    if (persisted) {
      this.cache(persisted);
      return persisted;
    }

    return undefined;
  }

  transition(
    id: string,
    nextStatus: SettlementStatus,
  ): SettlementInstruction {
    const settlement = this.get(id);

    if (!settlement) {
      throw new Error(`Settlement not found: ${id}`);
    }

    assertTransition(settlement.status, nextStatus);

    const updated: SettlementInstruction = {
      ...settlement,
      status: nextStatus,
      updatedAt: new Date().toISOString(),
    };

    this.cache(updated);
    this.repository?.save(updated);

    return updated;
  }

  private cache(
    settlement: SettlementInstruction,
  ): void {
    this.settlements.set(
      settlement.id,
      settlement,
    );

    this.idempotencyIndex.set(
      settlement.idempotencyKey,
      settlement.id,
    );
  }
}