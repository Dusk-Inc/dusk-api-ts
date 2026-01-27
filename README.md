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
