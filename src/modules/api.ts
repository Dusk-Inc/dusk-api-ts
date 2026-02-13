import express from "express";
import pino from "pino";
import pinoHttp from "pino-http";
import { HealthRouter } from "../routes/health";
import { MetricsRouter } from "../routes/metrics";
import { auditMiddleware } from "./audit";
import { traceMiddleware } from "../functions/trace";
import { getCorrelationId } from "../functions/context";
import { RuntimeManager } from "./runtime_manager";
import { SecretsPlugin } from "./secrets_plugin";
import type { RuntimePlugin } from "../contracts";
import type { SecretManager, SecretManagerOptions, SecretSnapshot } from "./secrets";
import type {
  AppManagerConfig,
} from "../contracts";
import {
  RUNTIME_DEPENDENCY_SECRETS_ENV,
  RUNTIME_DEPENDENCY_SECRETS_MANAGER,
  RUNTIME_DEPENDENCY_SECRETS_SNAPSHOT,
} from "../tokens";

export class AppManager {
  readonly app = express();
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
