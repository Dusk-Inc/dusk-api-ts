import type { Request, Response } from "express";

export type ActorSource = "header" | "query" | "body";

export type ActorMiddlewareErrorResponse = {
  error: {
    code: string;
    message: string;
  };
};

export type RequestData = Record<string, unknown>;

export type ActorReader = (
  req: Request,
  field: string,
  source: ActorSource
) => string | undefined;

export type MissingActorHandler = (
  req: Request,
  res: Response,
  payload: ActorMiddlewareErrorResponse,
  statusCode: number
) => void;
