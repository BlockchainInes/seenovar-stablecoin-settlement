import Fastify from "fastify";

import { SettlementRegistryClient } from "./blockchain/settlement-registry-client.js";
import { ComplianceEngine } from "./compliance.js";
import { SimulatedEvmExecutor } from "./execution.js";
import { SettlementLedger } from "./ledger.js";
import { SqliteSettlementRepository } from "./repositories/sqlite-settlement-repository.js";
import { settlementRoutes } from "./routes/settlements.js";
import { SettlementEngine } from "./settlement-engine.js";
import { SettlementOrchestrator } from "./settlement-orchestrator.js";
import { SettlementService } from "./settlement-service.js";

export interface BuildAppOptions {
  databasePath?: string;
}

export function buildApp(
  options: BuildAppOptions = {},
) {
  const app = Fastify({
    logger: true,
    ajv: {
      customOptions: {
        removeAdditional: false,
      },
    },
  });

  const isTest =
    process.env.NODE_ENV === "test";

  const databasePath =
    options.databasePath ??
    (isTest
      ? ":memory:"
      : "seenovar.db");

  const repository =
    new SqliteSettlementRepository(databasePath);

  const settlementEngine =
    new SettlementEngine(repository);

  const complianceEngine =
    new ComplianceEngine({
      blockedJurisdictions: ["KP", "IR"],
      maximumAutomaticAmount: 500000,
    });

  const settlementService =
    new SettlementService(
      settlementEngine,
      complianceEngine,
    );

  const ledger =
    new SettlementLedger();

  const executor =
    new SimulatedEvmExecutor();

  const registryClient =
    !isTest &&
    process.env.SEPOLIA_RPC_URL &&
    process.env.PRIVATE_KEY &&
    process.env.SEENOVAR_REGISTRY_ADDRESS
      ? new SettlementRegistryClient(
          process.env.SEPOLIA_RPC_URL,
          process.env.PRIVATE_KEY,
          process.env.SEENOVAR_REGISTRY_ADDRESS,
        )
      : undefined;

  const orchestrator =
    new SettlementOrchestrator(
      settlementEngine,
      executor,
      ledger,
      registryClient,
    );

  app.get("/health", async () => {
    return {
      status: "ok",
      service:
        "seenovar-stablecoin-settlement",
      version: "1.0.0",
      registryEnabled:
        registryClient !== undefined,
    };
  });

  app.register(settlementRoutes, {
    settlementService,
    settlementEngine,
    orchestrator,
    ledger,
  });

  app.addHook(
    "onClose",
    async () => {
      repository.close();
    },
  );

  return app;
}