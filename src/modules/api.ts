import express, { type Express } from "express";
import pino from "pino";
import pinoHttp from "pino-http";
import { HealthRouter } from "../routes/health.js";
import { MetricsRouter } from "../routes/metrics.js";
import { auditMiddleware } from "./audit.js";
import { traceMiddleware } from "../functions/trace.js";
import { getCorrelationId } from "../functions/context.js";
import { RuntimeManager } from "./runtime_manager.js";
import { SecretsPlugin } from "./secrets_plugin.js";
import type { RuntimePlugin } from "../contracts/index.js";
import type { SecretManager, SecretManagerOptions, SecretSnapshot } from "./secrets.js";
import type {
  AppManagerConfig,
} from "../contracts/index.js";
import {
  RUNTIME_DEPENDENCY_SECRETS_ENV,
  RUNTIME_DEPENDENCY_SECRETS_MANAGER,
  RUNTIME_DEPENDENCY_SECRETS_SNAPSHOT,
} from "../tokens/index.js";

export class AppManager {
  readonly app: Express = express();
  readonly logger;
  readonly runtime;

  readonly secrets = {
    use: (config: SecretManagerOptions = {}): AppManager => {
      this.runtime.use(new SecretsPlugin(config));
      return this;
    },
    getManager: (): SecretManager | undefined =>
      this.runtime.getDependency<SecretManager>(RUNTIME_DEPENDENCY_SECRETS_MANAGER),
    getSnapshot: (): SecretSnapshot | undefined =>
      this.runtime.getDependency<SecretSnapshot>(RUNTIME_DEPENDENCY_SECRETS_SNAPSHOT),
    getEnv: (): NodeJS.ProcessEnv | undefined =>
      this.runtime.getDependency<NodeJS.ProcessEnv>(RUNTIME_DEPENDENCY_SECRETS_ENV),
  };

  constructor(config: AppManagerConfig) {
    this.logger =
      config.logger ??
      pino({
        level: config.logLevel ?? "info",
        base: { service: config.serviceName },
      });

    this.runtime = new RuntimeManager(this.logger);

    this.app.use(traceMiddleware);
    this.app.use(
      pinoHttp({
        logger: this.logger,
        autoLogging: {
          ignore: (req) => req.url === "/metrics",
        },
        customProps: () => ({
          correlation_id: getCorrelationId() ?? null,
        }),
      })
    );
    this.app.use(auditMiddleware);

    this.app.use(express.json());
    this.app.use(new HealthRouter({ readiness: config.readiness }).router);
    this.app.use(new MetricsRouter().router);
  }

  use(plugin: RuntimePlugin): AppManager {
    this.runtime.use(plugin);
    return this;
  }

  getDependency<TValue>(key: string): TValue | undefined {
    return this.runtime.getDependency<TValue>(key);
  }

  async startRuntime(): Promise<void> {
    await this.runtime.start();
  }

  async stopRuntime(): Promise<void> {
    await this.runtime.stop();
  }
}
