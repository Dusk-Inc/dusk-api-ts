import express from "express";
import http from "node:http";
import type { AddressInfo } from "node:net";
import type { Request, Response } from "express";
import { traceMiddleware } from "./trace";
import { getCorrelationId } from "./context";

const buildApp = () => {
  const app = express();
  app.use(traceMiddleware);
  app.get("/trace", (req, res) => {
    res.status(200).json({ correlationId: getCorrelationId() });
  });
  return app;
};

const startServer = (app: express.Express) => {
  return new Promise<{ url: string; close: () => Promise<void> }>((resolve, reject) => {
    const server = app.listen(0, () => {
      const address = server.address() as AddressInfo | null;
      if (!address) {
        reject(new Error("Missing server address"));
        return;
      }
      const url = `http://127.0.0.1:${address.port}`;
      resolve({
        url,
        close: () =>
          new Promise((resolveClose, rejectClose) => {
            server.close((err) => (err ? rejectClose(err) : resolveClose()));
          })
      });
    });
  });
};

const request = (
  url: string,
  path: string,
  headers: http.OutgoingHttpHeaders = {}
) => {
  return new Promise<{
    status: number;
    headers: http.IncomingHttpHeaders;
    body: string;
  }>((resolve, reject) => {
    const req = http.request(`${url}${path}`, { method: "GET", headers }, (res) => {
      let body = "";
      res.setEncoding("utf8");
      res.on("data", (chunk) => {
        body += chunk;
      });
      res.on("end", () => {
        resolve({
          status: res.statusCode ?? 0,
          headers: res.headers,
          body
        });
      });
    });
    req.on("error", reject);
    req.end();
  });
};

describe("trace_middleware", () => {
  it("domain__header_present__uses_header_value", async () => {
    const app = buildApp();
    const server = await startServer(app);

    try {
      const response = await request(server.url, "/trace", {
        "x-correlation-id": "trace-123"
      });
      const payload = JSON.parse(response.body) as { correlationId: string };

      expect(response.status).toBe(200);
      expect(response.headers["x-correlation-id"]).toBe("trace-123");
      expect(payload.correlationId).toBe("trace-123");
    } finally {
      await server.close();
    }
  });

  it("boundary__header_missing__generates_uuid_and_sets_response_header", async () => {
    const app = buildApp();
    const server = await startServer(app);

    try {
      const response = await request(server.url, "/trace");
      const payload = JSON.parse(response.body) as { correlationId: string };
      const headerValue = response.headers["x-correlation-id"];

      expect(response.status).toBe(200);
      expect(typeof headerValue).toBe("string");
      expect(payload.correlationId).toBe(headerValue);
    } finally {
      await server.close();
    }
  });

  it("chaos__header_array__falls_back_to_uuid", () => {
    const req = {
      headers: {
        "x-correlation-id": ["a", "b"]
      }
    } as unknown as Request;
    let headerValue = "";
    const res = {
      setHeader: (key: string, value: string) => {
        if (key === "x-correlation-id") {
          headerValue = value;
        }
      }
    } as unknown as Response;
    const next = jest.fn();

    traceMiddleware(req, res, next);

    expect(headerValue).toMatch(/[0-9a-f-]{36}/);
    expect(next).toHaveBeenCalled();
  });
});
