import type { Request, Response } from "express";
import type {
  ActorReader,
} from "../contracts/index.js";
import type {
  ActorMiddlewareErrorResponse,
  ActorSource,
  RequestData,
} from "../contracts/index.js";

export const getHeaderValue = (value: string | string[] | undefined): string | undefined =>
  Array.isArray(value) ? value[0] : value;

export const readActorField: ActorReader = (
  req: Request,
  field: string,
  source: ActorSource
): string | undefined => {
  if (source === "header") {
    const value = req.headers[field.toLowerCase()] ?? req.headers[field];
    return getHeaderValue(value);
  }

  const requestData = (source === "query" ? req.query : req.body) as RequestData | undefined;
  if (!requestData) {
    return undefined;
  }

  const value = requestData[field];
  return typeof value === "string" ? value : undefined;
};

export const makeMissingActorPayload = (
  code: string,
  message: string
): ActorMiddlewareErrorResponse => ({
  error: { code, message },
});

export const sendMissingActor = (
  _req: Request,
  res: Response,
  payload: ActorMiddlewareErrorResponse,
  statusCode: number
): void => {
  res.status(statusCode).json(payload);
};
