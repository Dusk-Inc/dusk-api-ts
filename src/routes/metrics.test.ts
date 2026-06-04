import express from "express";
import { Gauge, Registry } from "prom-client";
import request from "supertest";
import { MetricsRouter } from "./metrics.js";

const buildApp = (registry?: Registry) => {
  const app = express();
  app.use(new MetricsRouter({ registry }).router);
  return app;
};

const buildRegistry = () => {
  const registry = new Registry();
  const gauge = new Gauge({
    name: "test_metric_total",
    help: "test_metric_total",
    registers: [registry]
  });
  gauge.set(1);
  return registry;
};

describe("metrics_routes", () => {
  it("domain__metrics_endpoint__returns_content_type_from_registry", async () => {
    const registry = buildRegistry();
    const app = buildApp(registry);
    const response = await request(app).get("/metrics");

    expect(response.status).toBe(200);
    expect(response.headers["content-type"]).toBe(registry.contentType);
  });

  it("boundary__custom_registry__uses_custom_registry_metrics", async () => {
    const registry = buildRegistry();
    const app = buildApp(registry);
    const response = await request(app).get("/metrics");

    expect(response.status).toBe(200);
    expect(response.text).toContain("test_metric_total");
  });
});
