import type { NextFunction, Request, Response } from "express";
import { ActorMiddleware } from "./actor";

describe("make_actor_middleware", () => {
  it("domain__header_field_present__sets_actor_and_calls_next", () => {
    const middleware = new ActorMiddleware("x-actor-id").handler;

    const req = {
      headers: {
        "x-actor-id": "actor-1",
      },
    } as unknown as Request;
    const status = jest.fn();
    const json = jest.fn();
    status.mockReturnValue({ json });
    const res = { status } as unknown as Response;
    const next = jest.fn() as unknown as NextFunction;

    middleware(req, res, next);

    expect(req.actorId).toBe("actor-1");
    expect(next).toHaveBeenCalled();
    expect(status).not.toHaveBeenCalled();
  });

  it("complement__required_and_missing__returns_unauthorized", () => {
    const middleware = new ActorMiddleware("x-actor-id").handler;

    const req = { headers: {} } as unknown as Request;
    const json = jest.fn();
    const status = jest.fn().mockReturnValue({ json });
    const res = { status } as unknown as Response;
    const next = jest.fn() as unknown as NextFunction;

    middleware(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(status).toHaveBeenCalledWith(401);
    expect(json).toHaveBeenCalledWith({
      error: {
        code: "UNAUTHORIZED",
        message: "Missing actor identity.",
      },
    });
  });

  it("boundary__optional_and_missing__passes_without_actor", () => {
    const middleware = new ActorMiddleware("x-actor-id", "header", false).handler;

    const req = { headers: {} } as unknown as Request;
    const status = jest.fn();
    const res = { status } as unknown as Response;
    const next = jest.fn() as unknown as NextFunction;

    middleware(req, res, next);

    expect(req.actorId).toBeUndefined();
    expect(next).toHaveBeenCalled();
    expect(status).not.toHaveBeenCalled();
  });

  it("domain__query_source__reads_actor_from_query", () => {
    const middleware = new ActorMiddleware("actor", "query").handler;

    const req = {
      headers: {},
      query: { actor: "query-actor" },
    } as unknown as Request;
    const status = jest.fn();
    const res = { status } as unknown as Response;
    const next = jest.fn() as unknown as NextFunction;

    middleware(req, res, next);

    expect(req.actorId).toBe("query-actor");
    expect(next).toHaveBeenCalled();
    expect(status).not.toHaveBeenCalled();
  });

  it("domain__custom_missing_payload__uses_configured_error", () => {
    const middleware = new ActorMiddleware(
      "actor",
      "body",
      true,
      403,
      "FORBIDDEN",
      "Actor is required."
    ).handler;

    const req = {
      headers: {},
      body: {},
    } as unknown as Request;
    const json = jest.fn();
    const status = jest.fn().mockReturnValue({ json });
    const res = { status } as unknown as Response;
    const next = jest.fn() as unknown as NextFunction;

    middleware(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(status).toHaveBeenCalledWith(403);
    expect(json).toHaveBeenCalledWith({
      error: {
        code: "FORBIDDEN",
        message: "Actor is required.",
      },
    });
  });

  it("domain__dependency_injection__uses_custom_actor_reader", () => {
    const readActorField = jest.fn().mockReturnValue("injected-actor");
    const middleware = new ActorMiddleware(
      "x-actor-id",
      "header",
      true,
      401,
      "UNAUTHORIZED",
      "Missing actor identity.",
      readActorField
    ).handler;

    const req = {
      headers: {},
    } as unknown as Request;
    const status = jest.fn();
    const res = { status } as unknown as Response;
    const next = jest.fn() as unknown as NextFunction;

    middleware(req, res, next);

    expect(readActorField).toHaveBeenCalledWith(req, "x-actor-id", "header");
    expect(req.actorId).toBe("injected-actor");
    expect(next).toHaveBeenCalled();
    expect(status).not.toHaveBeenCalled();
  });

  it("domain__dependency_injection__uses_custom_missing_handler", () => {
    const sendMissingActor = jest.fn();
    const middleware = new ActorMiddleware(
      "x-actor-id",
      "header",
      true,
      401,
      "UNAUTHORIZED",
      "Missing actor identity.",
      undefined,
      sendMissingActor
    ).handler;

    const req = {
      headers: {},
    } as unknown as Request;
    const status = jest.fn();
    const res = { status } as unknown as Response;
    const next = jest.fn() as unknown as NextFunction;

    middleware(req, res, next);

    expect(sendMissingActor).toHaveBeenCalledWith(
      req,
      res,
      {
        error: {
          code: "UNAUTHORIZED",
          message: "Missing actor identity.",
        },
      },
      401
    );
    expect(next).not.toHaveBeenCalled();
    expect(status).not.toHaveBeenCalled();
  });
});
