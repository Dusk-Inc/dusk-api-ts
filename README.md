# Dusk API (TypeScript)

Shared Express runtime and API utilities for Dusk services.

## Install

Add as a workspace dependency:

```json
{
  "dependencies": {
    "@dusk/dusk-api": "workspace:*"
  }
}
```

## Current Structure

- `src/modules`: runtime and middleware modules (`AppManager`, `SecretManager`, `ServiceDecorator`, `auditMiddleware`, `WellKnownRouter`)
- `src/routes`: route routers (`HealthRouter`, `MetricsRouter`)
- `src/contracts`: shared type contracts and route contracts
- `src/functions`: pure helpers (`parseEnv`, `sendNotImplemented`, secret parsing helpers, actor helpers, trace middleware helper)
- `src/tokens`: constants and tokenized route definitions for health/metrics and runtime tokens

## Quick Start

```ts
import { AppManager, parseEnv } from "@dusk/dusk-api";

const api = new AppManager({ serviceName: "my-service" });
const { app } = api;
const env = parseEnv();

app.listen(env.PORT, env.HOST, () => {
  console.log(`listening on http://${env.HOST}:${env.PORT}`);
});
```

## App Manager + Runtime

```ts
import { AppManager } from "@dusk/dusk-api";

const api = new AppManager({ serviceName: "my-service" });
api.secrets.use();
await api.startRuntime();

const app = api.app;
```

Notes:
- Runtime plugins are lifecycle-managed by `RuntimeManager`.
- `SecretsPlugin` is integrated via `api.secrets.use(...)`.

## Routers

`HealthRouter` and `MetricsRouter` are class-based routers exported from the package root.

```ts
import express from "express";
import { HealthRouter, MetricsRouter } from "@dusk/dusk-api";

const app = express();
app.use(new HealthRouter().router);
app.use(new MetricsRouter().router);
```

`WellKnownRouter` is in `modules` and uses well-known route contracts from `contracts/well_known.ts`.

```ts
import express from "express";
import { WellKnownRouter } from "@dusk/dusk-api";

const app = express();
app.use(
  new WellKnownRouter({
    issuer: "https://issuer.example.com",
    publicKeySet: { keys: [] },
  }).router
);
```

## Service Decorator

```ts
import { ServiceDecorator, SERVICE_DECORATOR_PHASE } from "@dusk/dusk-api";

const decorated = new ServiceDecorator(service, {
  serviceName: "example-service",
  rules: [
    {
      methods: ["save"],
      mapArgs: async (args, context) => {
        if (context.phase !== SERVICE_DECORATOR_PHASE.Encode) return args;
        return args;
      },
      mapResult: async (result, context) => {
        if (context.phase !== SERVICE_DECORATOR_PHASE.Decode) return result;
        return result;
      },
    },
  ],
}).decorate();
```

## Secrets

```ts
import { SecretManager } from "@dusk/dusk-api";

const manager = new SecretManager({
  secretPathEnvVar: "DUSK_SECRETS_FILE",
  secretPathDefault: "/var/run/secrets/dusk/secrets.env",
  requireReadOnlyFile: true,
});

await manager.loadSecrets();
await manager.startWatching();
```

Notes:
- file values are merged with environment values
- environment values take precedence
- rotation events expose keys and generation metadata (not secret values)
