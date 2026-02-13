import type { NextFunction, Request, Response } from "express";
import type { RequestLogger } from "../contracts";
import type { AuditLevel, AuditPayload } from "../contracts";

export const getHeaderValue = (value: string | string[] | undefined): string | undefined =>
  Array.isArray(value) ? value[0] : value;

export const readTraceId = (req: Request): string | undefined => {
  const correlationId = getHeaderValue(req.headers["x-correlation-id"]);
  if (correlationId && correlationId.length > 0) {
    return correlationId;
  }
  const traceId = getHeaderValue(req.headers["x-trace-id"]);
  if (traceId && traceId.length > 0) {
    return traceId;
  }
  return undefined;
};

export const auditMiddleware = (req: Request, _res: Response, next: NextFunction): void => {
  const traceId = readTraceId(req);
  req.traceId = traceId;
  req.logAudit = (level: AuditLevel, payload: AuditPayload): void => {
    const logger = (req as Request & { log?: RequestLogger }).log;
    const payloadWithTrace = traceId ? { ...payload, trace_id: traceId } : payload;
    if (level === "info") {
      logger?.info?.(payloadWithTrace);
      return;
    }
    logger?.error?.(payloadWithTrace);
  };
  next();
};
