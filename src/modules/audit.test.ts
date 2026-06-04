import type { NextFunction, Request, Response } from "express";
import { auditMiddleware } from "./audit.js";

describe("audit_middleware", () => {
  it("domain__correlation_header__attaches_trace_and_logs_with_trace", () => {
    const info = jest.fn();
    const error = jest.fn();
    const req = {
      headers: { "x-correlation-id": "corr-123" },
      log: { info, error },
    } as unknown as Request;
    const res = {} as Response;
    const next = jest.fn() as unknown as NextFunction;

    auditMiddleware(req, res, next);
    req.logAudit?.("info", { action: "test" });

    expect(next).toHaveBeenCalled();
    expect(req.traceId).toBe("corr-123");
    expect(info).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "test",
        trace_id: "corr-123",
      })
    );
  });

  it("boundary__trace_header__used_when_correlation_missing", () => {
    const info = jest.fn();
    const req = {
      headers: { "x-trace-id": "trace-321" },
      log: { info },
    } as unknown as Request;
    const res = {} as Response;

    auditMiddleware(req, res, jest.fn() as unknown as NextFunction);
    req.logAudit?.("info", { action: "test" });

    expect(req.traceId).toBe("trace-321");
    expect(info).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "test",
        trace_id: "trace-321",
      })
    );
  });

  it("complement__no_trace_headers__logs_without_trace", () => {
    const error = jest.fn();
    const req = {
      headers: {},
      log: { error },
    } as unknown as Request;
    const res = {} as Response;

    auditMiddleware(req, res, jest.fn() as unknown as NextFunction);
    req.logAudit?.("error", { action: "test" });

    expect(req.traceId).toBeUndefined();
    expect(error).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "test",
      })
    );
    expect(error).not.toHaveBeenCalledWith(expect.objectContaining({ trace_id: expect.anything() }));
  });
});

