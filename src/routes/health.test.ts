import express from "express";
import http from "node:http";
import type { AddressInfo } from "node:net";
import { HealthRouter } from "./health.js";

const buildApp = (readiness?: () => boolean | Promise<boolean>) => {
  const app = express();
  app.use(new HealthRouter({ readiness }).router);
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

const request = (url: string, path: string) => {
  return new Promise<{ status: number; body: string }>((resolve, reject) => {
    const req = http.request(`${url}${path}`, { method: "GET" }, (res) => {
      let body = "";
      res.setEncoding("utf8");
      res.on("data", (chunk) => {
        body += chunk;
      });
      res.on("end", () => {
        resolve({ status: res.statusCode ?? 0, body });
      });
    });
    req.on("error", reject);
    req.end();
  });
};

describe("health_routes", () => {
  it("domain__readiness_true__ready_returns_200", async () => {
    const app = buildApp(() => true);
    const server = await startServer(app);

    try {
      const response = await request(server.url, "/health/ready");
      const payload = JSON.parse(response.body) as { data: { status: string } };

      expect(response.status).toBe(200);
      expect(payload.data.status).toBe("ok");
    } finally {
      await server.close();
    }
  });

  it("complement__readiness_false__ready_returns_503", async () => {
    const app = buildApp(() => false);
    const server = await startServer(app);

    try {
      const response = await request(server.url, "/health/ready");
      const payload = JSON.parse(response.body) as { data: { status: string } };

      expect(response.status).toBe(503);
      expect(payload.data.status).toBe("unready");
    } finally {
      await server.close();
    }
  });

  it("boundary__no_readiness__defaults_true", async () => {
    const app = buildApp();
    const server = await startServer(app);

    try {
      const response = await request(server.url, "/health/ready");
      const payload = JSON.parse(response.body) as { data: { status: string } };

      expect(response.status).toBe(200);
      expect(payload.data.status).toBe("ok");
    } finally {
      await server.close();
    }
  });
});
