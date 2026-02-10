import type { NextFunction, Request, Response } from "express";

export type ActorSource = "header" | "query" | "body";

export type ActorMiddlewareErrorResponse = {
  error: {
    code: string;
    message: string;
  };
};

type RequestData = Record<string, unknown>;
type ActorReader = (req: Request, field: string, source: ActorSource) => string | undefined;
type MissingActorHandler = (
  req: Request,
  res: Response,
  payload: ActorMiddlewareErrorResponse,
  statusCode: number
) => void;

const getHeaderValue = (value: string | string[] | undefined): string | undefined =>
  Array.isArray(value) ? value[0] : value;

const readActorField = (
  req: Request,
  field: string,
  source: ActorSource
): string | undefined => {
  if (source === "header") {
    const value = req.headers[field.toLowerCase()] ?? req.headers[field];
    return getHeaderValue(value);
  }

  const requestData = (source === "query" ? req.query : req.body) as
    | RequestData
    | undefined;

  if (!requestData) {
    return undefined;
  }

  const value = requestData[field];
  return typeof value === "string" ? value : undefined;
};

const sendMissingActor = (
  _req: Request,
  res: Response,
  payload: ActorMiddlewareErrorResponse,
  statusCode: number
): void => {
  res.status(statusCode).json(payload);
};

declare global {
  namespace Express {
    interface Request {
      actorId?: string;
    }
  }
}

export class ActorMiddleware {
  private readonly field: string;
  private readonly source: ActorSource;
  private readonly required: boolean;
  private readonly missingStatusCode: number;
  private readonly missingCode: string;
  private readonly missingMessage: string;
  private readonly readActor: ActorReader;
  private readonly onMissingActor: MissingActorHandler;

  public constructor(
    field: string,
    source: ActorSource = "header",
    required = true,
    missingStatusCode = 401,
    missingCode = "UNAUTHORIZED",
    missingMessage = "Missing actor identity.",
    readActor: ActorReader = readActorField,
    onMissingActor: MissingActorHandler = sendMissingActor
  ) {
    this.field = field;
    this.source = source;
    this.required = required;
    this.missingStatusCode = missingStatusCode;
    this.missingCode = missingCode;
    this.missingMessage = missingMessage;
    this.readActor = readActor;
    this.onMissingActor = onMissingActor;
  }

  public readonly handler = (req: Request, res: Response, next: NextFunction): void => {
    const actorId = this.readActor(req, this.field, this.source);

    if (!actorId || actorId.length === 0) {
      req.actorId = undefined;
      if (!this.required) {
        next();
        return;
      }

      const payload: ActorMiddlewareErrorResponse = {
        error: {
          code: this.missingCode,
          message: this.missingMessage,
        },
      };
      this.onMissingActor(req, res, payload, this.missingStatusCode);
      return;
    }

    req.actorId = actorId;
    next();
  };
}

export const makeActorMiddleware = (
  field: string,
  source: ActorSource = "header",
  required = true,
  missingStatusCode = 401,
  missingCode = "UNAUTHORIZED",
  missingMessage = "Missing actor identity.",
  readActor: ActorReader = readActorField,
  onMissingActor: MissingActorHandler = sendMissingActor
) => {
  const actorMiddleware = new ActorMiddleware(
    field,
    source,
    required,
    missingStatusCode,
    missingCode,
    missingMessage,
    readActor,
    onMissingActor
  );
  return actorMiddleware.handler;
};
