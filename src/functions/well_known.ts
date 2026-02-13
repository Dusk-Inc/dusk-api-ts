import { wellKnownRoutes } from "../contracts";
import type { WellKnownRouterConfig } from "../contracts";

export const makeOpenIdConfiguration = (
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
    scopes_supported: ["openid", "profile", "email", "ai_access"],
  };

  if (config.availableModels) {
    payload.ai_models_supported = config.availableModels;
  }

  return payload;
};
