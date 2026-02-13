import type { z } from "zod";

export const RouteMethod = {
  Get: "GET",
  Post: "POST",
  Put: "PUT",
  Patch: "PATCH",
  Delete: "DELETE",
} as const;

export type RouteMethod = (typeof RouteMethod)[keyof typeof RouteMethod];

export type RouteContract<
  RequestSchema extends z.ZodTypeAny,
  ResponseSchema extends z.ZodTypeAny
> = {
  method: RouteMethod;
  path: string;
  request: RequestSchema;
  response: ResponseSchema;
};
