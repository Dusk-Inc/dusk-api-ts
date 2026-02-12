import { Router, Request, Response } from "express";
import {
  collectDefaultMetrics,
  Registry,
  register as defaultRegister
} from "prom-client";
import { metricsRoutes } from "../routes";

export type MetricsRouterConfig = {
  registry?: Registry;
};

let defaultMetricsStarted = false;

const ensureDefaultMetrics = (): void => {
  if (defaultMetricsStarted) {
    return;
  }

  collectDefaultMetrics();
  defaultMetricsStarted = true;
};

export const makeMetricsRouter = (config: MetricsRouterConfig = {}): Router => {
  const router = Router();
  const registry = config.registry ?? defaultRegister;

  ensureDefaultMetrics();

  router.get(metricsRoutes.collect.path, async (req: Request, res: Response) => {
    const metrics = await registry.metrics();
    res.status(200);
    res.setHeader("Content-Type", registry.contentType);
    res.end(metrics);
  });

  return router;
};
