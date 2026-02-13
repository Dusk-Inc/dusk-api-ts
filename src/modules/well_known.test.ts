import express from "express";
import request from "supertest";
import { WellKnownRouter } from "./well_known";

type WellKnownConfig = ConstructorParameters<typeof WellKnownRouter>[0];

const buildIssuer = () => "https://issuer.example.com";

const buildModel = (id = "model-1", caps = ["chat"]) => ({
  id,
  caps
});

const buildPublicKeySet = () => ({
  keys: [
    {
      kty: "RSA",
      kid: "test-key",
      use: "sig",
      n: "abc",
      e: "AQAB"
    }
  ]
});

const buildConfig = (
  overrides: Partial<WellKnownConfig> = {}
): WellKnownConfig => ({
  issuer: buildIssuer(),
  availableModels: [buildModel()],
  publicKeySet: buildPublicKeySet(),
  ...overrides
});

const buildApp = (config: WellKnownConfig) => {
  const app = express();
  app.use(new WellKnownRouter(config).router);
  return app;
};

describe("well_known_routes", () => {
  it("domain__openid_configuration__returns_expected_configuration", async () => {
    const config = buildConfig();
    const app = buildApp(config);
    const response = await request(app).get("/.well-known/openid-configuration");

    expect(response.status).toBe(200);
    expect(response.body.issuer).toBe(config.issuer);
    expect(response.body.jwks_uri).toBe(`${config.issuer}/.well-known/jwks.json`);
    expect(response.body.ai_models_supported).toEqual(config.availableModels);
    expect(response.body.jwks_uri.startsWith(config.issuer)).toBe(true);
  });

  it("boundary__no_models__omits_ai_models_supported", async () => {
    const config = buildConfig({ availableModels: undefined });
    const app = buildApp(config);
    const response = await request(app).get("/.well-known/openid-configuration");

    expect(response.status).toBe(200);
    expect(response.body.ai_models_supported).toBeUndefined();
    expect(response.body.jwks_uri.startsWith(config.issuer)).toBe(true);
  });

  it("domain__jwks_endpoint__returns_public_key_set", async () => {
    const config = buildConfig();
    const app = buildApp(config);
    const response = await request(app).get("/.well-known/jwks.json");

    expect(response.status).toBe(200);
    expect(response.body).toEqual(config.publicKeySet);
  });

  it("complement__unknown_path__returns_404", async () => {
    const config = buildConfig();
    const app = buildApp(config);
    const response = await request(app).get("/.well-known/unknown");

    expect(response.status).toBe(404);
  });

  it("chaos__post_openid_configuration__returns_404", async () => {
    const config = buildConfig();
    const app = buildApp(config);
    const response = await request(app).post("/.well-known/openid-configuration");

    expect(response.status).toBe(404);
  });
});
