import { Router, Request, Response } from "express";
import { wellKnownRoutes } from "../contracts";
import { makeOpenIdConfiguration } from "../functions";
import type { DiscoveryModel, WellKnownRouterConfig } from "../contracts";
export type { DiscoveryModel, WellKnownRouterConfig } from "../contracts";

export class WellKnownRouter {
  public readonly router: Router;

  public constructor(private readonly config: WellKnownRouterConfig) {
    this.router = Router();

    this.router.get(wellKnownRoutes.openidConfiguration.path, (req: Request, res: Response) => {
      res.status(200).json(makeOpenIdConfiguration(this.config));
    });

    this.router.get(wellKnownRoutes.jwks.path, (req: Request, res: Response) => {
      res.status(200).json(this.config.publicKeySet);
    });
  }
}
