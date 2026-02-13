import { z } from "zod";

export const API_ROUTE_METHOD = {
  Get: "GET",
  Post: "POST",
  Put: "PUT",
  Patch: "PATCH",
  Delete: "DELETE",
} as const;

export const healthLiveContract = {
  method: API_ROUTE_METHOD.Get,
  path: "/health/live",
  response: z.object({
    data: z.object({
      status: z.literal("ok"),
    }),
  }),
};

export const healthReadyContract = {
  method: API_ROUTE_METHOD.Get,
  path: "/health/ready",
  response: z.object({
    data: z.object({
      status: z.enum(["ok", "unready"]),
    }),
  }),
};

export const healthRoutes = {
  live: healthLiveContract,
  ready: healthReadyContract,
} as const;

export const metricsContract = {
  method: API_ROUTE_METHOD.Get,
  path: "/metrics",
  response: z.string(),
};

export const metricsRoutes = {
  collect: metricsContract,
} as const;
