import { Router, Request, Response } from "express";
import { wellKnownRoutes } from "../routes";

export type DiscoveryModel = {
  id: string;
  caps: string[];
};

export type WellKnownRouterConfig = {
  issuer: string;
  availableModels?: DiscoveryModel[];
  publicKeySet: Record<string, unknown>;
};

const makeOpenIdConfiguration = (
  config: WellKnownRouterConfig
): Record<string, unknown> => {
  const payload: Record<string, unknown> = {
    issuer: config.issuer,
    jwks_uri: `${config.issuer}${wellKnownRoutes.jwks.path}`,
    authorization_endpoint: `${config.issuer}/authorize`,
    token_endpoint: `${config.issuer}/token`,
    userinfo_endpoint: `${config.issuer}/userinfo`,
    ai_endpoint: `${config.issuer}/ai/models`,
    id_token_signing_alg_values_supported: ["RS256"],
    response_types_supported: ["code", "id_token"],
    scopes_supported: ["openid", "profile", "email", "ai_access"]
  };

  if (config.availableModels) {
    payload.ai_models_supported = config.availableModels;
  }

  return payload;
};


export const makeWellKnownRouter = (
  config: WellKnownRouterConfig
): Router => {
  const router = Router();

  router.get(wellKnownRoutes.openidConfiguration.path, (req: Request, res: Response) => {
    res.status(200).json(makeOpenIdConfiguration(config));
  });

  router.get(wellKnownRoutes.jwks.path, (req: Request, res: Response) => {
    res.status(200).json(config.publicKeySet);
  });

  return router;
};
