import { Router, Request, Response } from "express";
import {
  collectDefaultMetrics,
  register as defaultRegister
} from "prom-client";
import { metricsRoutes } from "../tokens";
import type { MetricsRouterConfig } from "../contracts";
export type { MetricsRouterConfig } from "../contracts";

let defaultMetricsStarted = false;

const ensureDefaultMetrics = (): void => {
  if (defaultMetricsStarted) {
    return;
  }

  collectDefaultMetrics();
  defaultMetricsStarted = true;
};

export class MetricsRouter {
  public readonly router: Router;

  public constructor(config: MetricsRouterConfig = {}) {
    this.router = Router();
    const registry = config.registry ?? defaultRegister;

    ensureDefaultMetrics();

    this.router.get(metricsRoutes.collect.path, async (req: Request, res: Response) => {
      const metrics = await registry.metrics();
      res.status(200);
      res.setHeader("Content-Type", registry.contentType);
      res.end(metrics);
    });
  }
}
