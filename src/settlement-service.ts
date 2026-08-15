import {
  ComplianceEngine,
  type ComplianceResult,
} from "./compliance.js";
import {
  SettlementEngine,
  type CreateSettlementInput,
} from "./settlement-engine.js";
import type { SettlementInstruction } from "./types.js";

export interface ComplianceSettlementResult {
  settlement: SettlementInstruction;
  compliance: ComplianceResult;
}

export class SettlementService {
  constructor(
    private readonly settlementEngine: SettlementEngine,
    private readonly complianceEngine: ComplianceEngine,
  ) {}

  createAndEvaluate(
    input: CreateSettlementInput,
  ): ComplianceSettlementResult {
    const created = this.settlementEngine.create(input);

    if (created.status !== "CREATED") {
      return {
        settlement: created,
        compliance: this.complianceEngine.evaluate(created),
      };
    }

    const pending = this.settlementEngine.transition(
      created.id,
      "COMPLIANCE_PENDING",
    );

    const compliance = this.complianceEngine.evaluate(pending);

    if (compliance.decision === "APPROVED") {
      const approved = this.settlementEngine.transition(
        pending.id,
        "APPROVED",
      );

      return {
        settlement: approved,
        compliance,
      };
    }

    if (compliance.decision === "REJECTED") {
      const failed = this.settlementEngine.transition(
        pending.id,
        "FAILED",
      );

      return {
        settlement: failed,
        compliance,
      };
    }

    return {
      settlement: pending,
      compliance,
    };
  }
}