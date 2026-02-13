import { Router, Request, Response } from "express";
import { healthRoutes } from "../tokens";
import type { ReadinessCheck } from "../contracts";
import type { HealthRouterConfig } from "../contracts";
export type { ReadinessCheck } from "../contracts";
export type { HealthRouterConfig } from "../contracts";

const okPayload = { data: { status: "ok" } };

export class HealthRouter {
  public readonly router: Router;

  public constructor(config: HealthRouterConfig = {}) {
    this.router = Router();
    const readiness = config.readiness ?? (() => true);

    this.router.get(healthRoutes.live.path, (req: Request, res: Response) => {
      res.status(200).json(okPayload);
    });

    this.router.get(healthRoutes.ready.path, async (req: Request, res: Response) => {
      const ready = await readiness();

      if (ready) {
        res.status(200).json(okPayload);
        return;
      }

      res.status(503).json({ data: { status: "unready" } });
    });
  }
}
