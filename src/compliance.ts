import type { SettlementInstruction } from "./types.js";

export type ComplianceDecision =
  | "APPROVED"
  | "REJECTED"
  | "MANUAL_REVIEW";

export interface ComplianceResult {
  decision: ComplianceDecision;
  reasons: string[];
  checkedAt: string;
}

export interface CompliancePolicy {
  blockedJurisdictions: readonly string[];
  maximumAutomaticAmount: number;
}

export class ComplianceEngine {
  constructor(private readonly policy: CompliancePolicy) {}

  evaluate(settlement: SettlementInstruction): ComplianceResult {
    const reasons: string[] = [];

    const senderJurisdiction =
      settlement.sender.jurisdiction.toUpperCase();

    const recipientJurisdiction =
      settlement.recipient.jurisdiction.toUpperCase();

    const blockedJurisdictions =
      this.policy.blockedJurisdictions.map((jurisdiction) =>
        jurisdiction.toUpperCase(),
      );

    if (blockedJurisdictions.includes(senderJurisdiction)) {
      reasons.push(
        `Sender jurisdiction blocked: ${senderJurisdiction}`,
      );
    }

    if (blockedJurisdictions.includes(recipientJurisdiction)) {
      reasons.push(
        `Recipient jurisdiction blocked: ${recipientJurisdiction}`,
      );
    }

    if (reasons.length > 0) {
      return {
        decision: "REJECTED",
        reasons,
        checkedAt: new Date().toISOString(),
      };
    }

    const amount = Number(settlement.amount);

    if (!Number.isFinite(amount) || amount <= 0) {
      return {
        decision: "REJECTED",
        reasons: ["Settlement amount is invalid"],
        checkedAt: new Date().toISOString(),
      };
    }

    if (amount > this.policy.maximumAutomaticAmount) {
      return {
        decision: "MANUAL_REVIEW",
        reasons: [
          `Amount exceeds automatic approval threshold: ${this.policy.maximumAutomaticAmount}`,
        ],
        checkedAt: new Date().toISOString(),
      };
    }

    return {
      decision: "APPROVED",
      reasons: [],
      checkedAt: new Date().toISOString(),
    };
  }
}