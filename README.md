# Base API (TypeScript)

Shared Express base for Dusk services. Provides standard middleware, health checks, and metrics.

## Usage

1. Add to an app package.json as a workspace dependency: `"@dusk/dusk-api": "workspace:*"`.
2. Create a server entrypoint that builds the app and starts listening.

## Example

```ts
import { buildApp, parseEnv } from "@dusk/dusk-api";

const { app } = buildApp({ serviceName: "my-service" });
const env = parseEnv();

app.listen(env.PORT, env.HOST, () => {
  console.log(`listening on http://${env.HOST}:${env.PORT}`);
});
```

## Custom Middleware & Routes

```ts
import express from "express";
import { buildApp, parseEnv } from "@dusk/dusk-api";

const { app } = buildApp({ serviceName: "my-service" });
const env = parseEnv();

app.use((req, res, next) => {
  res.setHeader("x-service", "my-service");
  next();
});

const router = express.Router();
router.get("/status", (req, res) => {
  res.status(200).json({ data: { status: "ok" } });
});
app.use(router);

app.use((req, res) => {
  res.status(404).json({
    error: {
      code: "NOT_FOUND",
      message: "Route not found.",
    },
  });
});

app.listen(env.PORT, env.HOST, () => {
  console.log(`listening on http://${env.HOST}:${env.PORT}`);
});
```

## Service Decorator Middleware (Encryption/Decryption)

Use the service decorator toolkit when you need request/response transforms at a service boundary (for example, encrypt before persistence and decrypt on read).

The decorator is method-aware and supports explicit mapper functions so transforms are easy to test before wiring into runtime services.

### Example

```ts
import {
  ServiceDecorator,
  SERVICE_DECORATOR_PHASE,
  ServiceDecoratorTransformError,
} from "@dusk/dusk-api";
import { mapFieldSelectors } from "@dusk/dusk-core";

type Store = {
  savePin: (
    certId: string,
    pin: { verifierHex: string; saltB64: string }
  ) => Promise<{ pin: { verifierHex: string; saltB64: string } }>;
};

const encrypt = (value: string): string => `sealed:${value}`;
const decrypt = (value: string): string => {
  if (!value.startsWith("sealed:")) {
    throw new Error("Invalid sealed value.");
  }
  return value.slice("sealed:".length);
};

const pinArgSelectors = [[1, "verifierHex"], [1, "saltB64"]] as const;
const pinResultSelectors = [["pin", "verifierHex"], ["pin", "saltB64"]] as const;

export const decorateStore = (store: Store): Store =>
  new ServiceDecorator(store, {
    serviceName: "certificate_data",
    rules: [
      {
        methods: ["savePin"],
        mapArgs: async (args, context) => {
          if (context.phase !== SERVICE_DECORATOR_PHASE.Encode) {
            throw new ServiceDecoratorTransformError({
              phase: context.phase,
              target: `${context.serviceName}.${context.methodName}`,
              message: "Data transform failed.",
            });
          }
          return mapFieldSelectors(args, pinArgSelectors, (value) => {
            if (typeof value !== "string") {
              throw new ServiceDecoratorTransformError({
                phase: context.phase,
                target: `${context.serviceName}.${context.methodName}`,
                message: "Data transform failed.",
              });
            }
            return encrypt(value);
          });
        },
      },
      {
        methods: ["savePin"],
        mapResult: async (result, context) => {
          if (context.phase !== SERVICE_DECORATOR_PHASE.Decode) {
            throw new ServiceDecoratorTransformError({
              phase: context.phase,
              target: `${context.serviceName}.${context.methodName}`,
              message: "Data transform failed.",
            });
          }
          return mapFieldSelectors(result, pinResultSelectors, (value) => {
            if (typeof value !== "string") {
              throw new ServiceDecoratorTransformError({
                phase: context.phase,
                target: `${context.serviceName}.${context.methodName}`,
                message: "Data transform failed.",
              });
            }
            return decrypt(value);
          });
        },
      },
    ],
  }).decorate();
```

### Notes

- Prefer injecting encryption/decryption logic from your app/service so crypto strategy stays app-specific.
- Use strict typed transform errors (`ServiceDecoratorTransformError`) and avoid leaking sensitive values in error messages.
- Use explicit selectors + mapper functions (`mapFieldSelectors`) for predictable, testable field transforms.

## Secret Manager (Vault Agent File + Env Merge)

Use `SecretManager` when a service reads secrets from a mounted file (for example Vault Agent output) and needs rotation-aware updates without restarting.

```ts
import { SecretManager } from "@dusk/dusk-api";

const secrets = new SecretManager({
  secretPathEnvVar: "DUSK_SECRETS_FILE",
  secretPathDefault: "/var/run/secrets/dusk/secrets.env",
  requireReadOnlyFile: true,
});

await secrets.loadSecrets();
await secrets.startWatching();

const dbUser = secrets.getRequiredSecret("DB_USER");
const dbPass = secrets.getRequiredSecret("DB_PASS");

const unsubscribe = secrets.onRotate((rotation) => {
  // Use rotation keys to decide which clients/pools to refresh.
  console.log("secret generation", rotation.generation, rotation.updatedKeys);
});

// Later during shutdown:
unsubscribe();
secrets.stopWatching();
```

Notes:
- Environment variables always override file values.
- Rotation events expose key names only (no secret values).
- Missing file falls back to environment-only mode.
