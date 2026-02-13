import type { AuditLevel, AuditPayload } from "../contracts";

declare global {
  namespace Express {
    interface Request {
      actorId?: string;
      traceId?: string;
      logAudit?: (level: AuditLevel, payload: AuditPayload) => void;
    }
  }
}

export {};
