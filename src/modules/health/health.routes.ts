import { Router, Request, Response } from "express";
import { healthRoutes } from "../routes";

export type ReadinessCheck = () => boolean | Promise<boolean>;

export type HealthRouterConfig = {
  readiness?: ReadinessCheck;
};

const okPayload = { data: { status: "ok" } };

export const makeHealthRouter = (config: HealthRouterConfig = {}): Router => {
  const router = Router();
  const readiness = config.readiness ?? (() => true);

  router.get(healthRoutes.live.path, (req: Request, res: Response) => {
    res.status(200).json(okPayload);
  });

  router.get(healthRoutes.ready.path, async (req: Request, res: Response) => {
    const ready = await readiness();

    if (ready) {
      res.status(200).json(okPayload);
      return;
    }

    res.status(503).json({ data: { status: "unready" } });
  });

  return router;
};
