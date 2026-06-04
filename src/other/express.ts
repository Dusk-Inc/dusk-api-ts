import type { AuditLevel, AuditPayload } from "../contracts/index.js";

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
