import { Router, Request, Response } from "express";
import { wellKnownRoutes } from "../contracts/index.js";
import { makeOpenIdConfiguration } from "../functions/index.js";
import type { DiscoveryModel, WellKnownRouterConfig } from "../contracts/index.js";
export type { DiscoveryModel, WellKnownRouterConfig } from "../contracts/index.js";

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
