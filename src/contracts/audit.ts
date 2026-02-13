export type AuditLevel = "info" | "error";
export type AuditPayload = Record<string, unknown>;

export type RequestLogger = {
  info?: (arg: unknown) => void;
  error?: (arg: unknown) => void;
};
