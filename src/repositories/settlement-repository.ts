import type {
  SettlementInstruction,
  SettlementStatus,
} from "../types.js";

export interface SettlementRepository {
  save(
    settlement: SettlementInstruction,
  ): SettlementInstruction;

  findById(
    id: string,
  ): SettlementInstruction | undefined;

  findByIdempotencyKey(
    idempotencyKey: string,
  ): SettlementInstruction | undefined;

  list(): SettlementInstruction[];

  updateStatus(
    id: string,
    status: SettlementStatus,
  ): SettlementInstruction;
}