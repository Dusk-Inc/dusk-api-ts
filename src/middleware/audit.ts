import type { NextFunction, Request, Response } from "express";

type AuditLevel = "info" | "error";
type AuditPayload = Record<string, unknown>;

type RequestLogger = {
  info?: (arg: unknown) => void;
  error?: (arg: unknown) => void;
};

const getHeaderValue = (value: string | string[] | undefined): string | undefined =>
  Array.isArray(value) ? value[0] : value;

const readTraceId = (req: Request): string | undefined => {
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

declare global {
  namespace Express {
    interface Request {
      traceId?: string;
      logAudit?: (level: AuditLevel, payload: AuditPayload) => void;
    }
  }
}

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

