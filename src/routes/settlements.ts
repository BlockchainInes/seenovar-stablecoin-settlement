
import type { FastifyInstance } from "fastify";

import type { SettlementLedger } from "../ledger.js";
import type { SettlementEngine } from "../settlement-engine.js";
import type { SettlementOrchestrator } from "../settlement-orchestrator.js";
import type { SettlementService } from "../settlement-service.js";
import type { CreateSettlementInput } from "../settlement-engine.js";

interface SettlementRequestBody {
  idempotencyKey: string;
  sender: {
    walletAddress: string;
    legalName: string;
    jurisdiction: string;
  };
  recipient: {
    walletAddress: string;
    legalName: string;
    jurisdiction: string;
  };
  asset: {
    symbol: "USDC";
    decimals: 6;
    chainId: number;
    contractAddress: string;
  };
  amount: string;
}

interface SettlementRouteOptions {
  settlementService: SettlementService;
  settlementEngine: SettlementEngine;
  orchestrator: SettlementOrchestrator;
  ledger: SettlementLedger;
}

const settlementBodySchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "idempotencyKey",
    "sender",
    "recipient",
    "asset",
    "amount",
  ],
  properties: {
    idempotencyKey: {
      type: "string",
      minLength: 1,
      maxLength: 128,
    },
    sender: {
      type: "object",
      additionalProperties: false,
      required: [
        "walletAddress",
        "legalName",
        "jurisdiction",
      ],
      properties: {
        walletAddress: {
          type: "string",
          pattern: "^0x[a-fA-F0-9]{40}$",
        },
        legalName: {
          type: "string",
          minLength: 1,
          maxLength: 200,
        },
        jurisdiction: {
          type: "string",
          pattern: "^[A-Za-z]{2}$",
        },
      },
    },
    recipient: {
      type: "object",
      additionalProperties: false,
      required: [
        "walletAddress",
        "legalName",
        "jurisdiction",
      ],
      properties: {
        walletAddress: {
          type: "string",
          pattern: "^0x[a-fA-F0-9]{40}$",
        },
        legalName: {
          type: "string",
          minLength: 1,
          maxLength: 200,
        },
        jurisdiction: {
          type: "string",
          pattern: "^[A-Za-z]{2}$",
        },
      },
    },
    asset: {
      type: "object",
      additionalProperties: false,
      required: [
        "symbol",
        "decimals",
        "chainId",
        "contractAddress",
      ],
      properties: {
        symbol: {
          type: "string",
          enum: ["USDC"],
        },
        decimals: {
          type: "integer",
          enum: [6],
        },
        chainId: {
          type: "integer",
          minimum: 1,
        },
        contractAddress: {
          type: "string",
          pattern: "^0x[a-fA-F0-9]{40}$",
        },
      },
    },
    amount: {
      type: "string",
      pattern: "^[0-9]+(\\.[0-9]{1,6})?$",
    },
  },
} as const;

export async function settlementRoutes(
  app: FastifyInstance,
  options: SettlementRouteOptions,
): Promise<void> {
  const {
    settlementService,
    settlementEngine,
    orchestrator,
    ledger,
  } = options;

  app.post<{ Body: SettlementRequestBody }>(
    "/settlements",
    {
      schema: {
        body: settlementBodySchema,
      },
    },
    async (request, reply) => {
      const input: CreateSettlementInput = {
        idempotencyKey: request.body.idempotencyKey,
        sender: request.body.sender,
        recipient: request.body.recipient,
        asset: request.body.asset,
        amount: request.body.amount,
      };

      const result =
        settlementService.createAndEvaluate(input);

      return reply.code(201).send({
        settlement: result.settlement,
        compliance: result.compliance,
      });
    },
  );

  app.get<{ Params: { id: string } }>(
    "/settlements/:id",
    async (request, reply) => {
      const settlement =
        settlementEngine.get(request.params.id);

      if (!settlement) {
        return reply.code(404).send({
          error: "SETTLEMENT_NOT_FOUND",
          message:
            `Settlement not found: ${request.params.id}`,
        });
      }

      return reply.code(200).send({
        settlement,
      });
    },
  );

  app.post<{ Params: { id: string } }>(
    "/settlements/:id/execute",
    async (request, reply) => {
      const settlement =
        settlementEngine.get(request.params.id);

      if (!settlement) {
        return reply.code(404).send({
          error: "SETTLEMENT_NOT_FOUND",
          message:
            `Settlement not found: ${request.params.id}`,
        });
      }

      if (settlement.status !== "APPROVED") {
        return reply.code(409).send({
          error: "SETTLEMENT_NOT_EXECUTABLE",
          message:
            `Settlement must be APPROVED before execution: ${settlement.status}`,
        });
      }

      const executed =
        await orchestrator.executeApprovedSettlement(
          request.params.id,
        );

      return reply.code(200).send({
        settlement: executed.settlement,
        transactionHash:
          executed.transactionHash,
        ledgerEntry:
          ledger.get(request.params.id),
        registryRegistration:
          executed.registryRegistration ?? null,
        registryReconciliation:
          executed.registryReconciliation ?? null,
      });
    },
  );

  app.get<{ Params: { id: string } }>(
    "/settlements/:id/ledger",
    async (request, reply) => {
      const entry =
        ledger.get(request.params.id);

      if (!entry) {
        return reply.code(404).send({
          error: "LEDGER_ENTRY_NOT_FOUND",
          message:
            `Ledger entry not found: ${request.params.id}`,
        });
      }

      return reply.code(200).send({
        entry,
      });
    },
  );
}