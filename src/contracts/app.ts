import type { Express } from "express";
import type { Logger, LevelWithSilent } from "pino";
import type { ReadinessCheck } from "./health.js";

export type AppManagerConfig = {
  serviceName: string;
  logLevel?: LevelWithSilent;
  logger?: Logger;
  readiness?: ReadinessCheck;
  /**
   * Largest JSON request body the manager's parser accepts, in body-parser's own notation
   * (`"16mb"`). Defaults to body-parser's 100kb, which a service carrying file bytes in its
   * request shape must raise — the parser is mounted before any route, so a service cannot
   * widen it afterwards.
   */
  jsonLimit?: string | number;
};

export type AppManagerModel = {
  app: Express;
  logger: Logger;
};

export type AppConfig = AppManagerConfig;
export type AppModel = AppManagerModel;
