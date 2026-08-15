import type { SettlementStatus } from "./types.js";

const allowedTransitions: Record<SettlementStatus, readonly SettlementStatus[]> = {
  CREATED: ["COMPLIANCE_PENDING"],
  COMPLIANCE_PENDING: ["APPROVED", "FAILED"],
  APPROVED: ["SUBMITTED", "FAILED"],
  SUBMITTED: ["CONFIRMED", "FAILED"],
  CONFIRMED: ["RECONCILED", "FAILED"],
  RECONCILED: [],
  FAILED: [],
};

export function canTransition(
  currentStatus: SettlementStatus,
  nextStatus: SettlementStatus,
): boolean {
  return allowedTransitions[currentStatus].includes(nextStatus);
}

export function assertTransition(
  currentStatus: SettlementStatus,
  nextStatus: SettlementStatus,
): void {
  if (!canTransition(currentStatus, nextStatus)) {
    throw new Error(
      `Invalid settlement transition: ${currentStatus} -> ${nextStatus}`,
    );
  }
}