import type { Express } from "express";
import type { Logger, LevelWithSilent } from "pino";
import type { ReadinessCheck } from "./health";

export type AppManagerConfig = {
  serviceName: string;
  logLevel?: LevelWithSilent;
  logger?: Logger;
  readiness?: ReadinessCheck;
};

export type AppManagerModel = {
  app: Express;
  logger: Logger;
};

export type AppConfig = AppManagerConfig;
export type AppModel = AppManagerModel;
