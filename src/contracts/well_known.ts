import { z } from "zod";
import { RouteMethod } from "./routes";

export type DiscoveryModel = {
  id: string;
  caps: string[];
};

export type WellKnownRouterConfig = {
  issuer: string;
  availableModels?: DiscoveryModel[];
  publicKeySet: Record<string, unknown>;
};

export const wellKnownOpenIdConfigurationContract = {
  method: RouteMethod.Get,
  path: "/.well-known/openid-configuration",
  response: z.record(z.unknown()),
};

export const wellKnownJwksContract = {
  method: RouteMethod.Get,
  path: "/.well-known/jwks.json",
  response: z.record(z.unknown()),
};

export const wellKnownRoutes = {
  openidConfiguration: wellKnownOpenIdConfigurationContract,
  jwks: wellKnownJwksContract,
} as const;
