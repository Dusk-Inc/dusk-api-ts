import type { NextFunction, Request, Response } from "express";
import {
  readActorField,
  sendMissingActor,
  makeMissingActorPayload,
} from "../functions/index.js";
import type {
  ActorReader,
  MissingActorHandler,
} from "../contracts/index.js";
import type {
  ActorMiddlewareErrorResponse,
  ActorSource,
} from "../contracts/index.js";
import {
  ACTOR_DEFAULT_MISSING_CODE,
  ACTOR_DEFAULT_MISSING_MESSAGE,
  ACTOR_DEFAULT_MISSING_STATUS_CODE,
  ACTOR_DEFAULT_REQUIRED,
  ACTOR_DEFAULT_SOURCE,
} from "../tokens/index.js";

export type { ActorMiddlewareErrorResponse, ActorSource } from "../contracts/index.js";

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
    source: ActorSource = ACTOR_DEFAULT_SOURCE,
    required = ACTOR_DEFAULT_REQUIRED,
    missingStatusCode = ACTOR_DEFAULT_MISSING_STATUS_CODE,
    missingCode = ACTOR_DEFAULT_MISSING_CODE,
    missingMessage = ACTOR_DEFAULT_MISSING_MESSAGE,
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

      const payload = makeMissingActorPayload(this.missingCode, this.missingMessage);
      this.onMissingActor(req, res, payload, this.missingStatusCode);
      return;
    }

    req.actorId = actorId;
    next();
  };
}
