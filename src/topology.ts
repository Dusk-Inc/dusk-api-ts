import express, { Express } from "express";
import pino, { Logger, LevelWithSilent } from "pino";
import pinoHttp from "pino-http";
import { makeHealthRouter, ReadinessCheck } from "./routes/health/health.routes";
import { makeMetricsRouter } from "./routes/metrics/metrics.routes";
import { traceMiddleware } from "./middleware/trace";
import { getCorrelationId } from "./modules/context/context";

export type AppConfig = {
  serviceName: string;
  logLevel?: LevelWithSilent;
  logger?: Logger;
  readiness?: ReadinessCheck;
};

export type AppModel = {
  app: Express;
  logger: Logger;
};

export const buildApp = (config: AppConfig): AppModel => {
  const logger =
    config.logger ??
    pino({
      level: config.logLevel ?? "info",
      base: { service: config.serviceName },
    });

  const app = express();

  app.use(traceMiddleware);
  app.use(
    pinoHttp({
      logger,
      autoLogging: {
        ignore: (req) => req.url === "/metrics",
      },
      customProps: () => ({
        correlation_id: getCorrelationId() ?? null,
      }),
    })
  );

  app.use(express.json());
  app.use(makeHealthRouter({ readiness: config.readiness }));
  app.use(makeMetricsRouter());

  return { app, logger };
};
