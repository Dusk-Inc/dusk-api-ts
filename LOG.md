# dusk-api-ts — Implementation Log

What's shipped today and what's still open.

## `AppManager` takes a JSON body limit

`AppManagerConfig.jsonLimit` sets the parser's ceiling; omitted, it stays body-parser's 100kb
default, so nothing that does not ask changes.

The manager mounts `express.json()` in its constructor, before any route a service registers.
A service whose request shape carries file bytes therefore could not widen the limit at all —
its own `express.json({ limit })` never runs, because the manager's parser has already refused
the body with a 413. Configuring it here is the only place it can be configured from.

## Not yet implemented

- **`SecretManager.startWatching` crashes when the watch directory does not exist.** `src/modules/secrets.ts` `startWatching()` calls `fs.watch(path.dirname(secretPath))` unconditionally. If the directory at `/var/run/secrets/dusk` (or whatever `DUSK_SECRETS_FILE` resolves to) is absent, `fs.watch` throws `ENOENT` and the api exits 1 on startup — even when every secret it actually needs is available via `process.env` (e.g. a Kubernetes `secretKeyRef` env mapping). This forces downstream charts to mount a stub file just to materialize the directory; see `repos/infra/k8s/plexus-library-prelaunch/templates/api-deployment.yaml` for the "mount the Mailchimp Secret as a no-op volume so the watcher doesn't crash" workaround. Fix: make `startWatching` stat the directory first, log a single warning, and skip the watcher if the directory is missing (or `fs.watch` throws). `collectSecrets()` already falls back to `process.env` via `mergeWithProcessEnv`, so `getRequiredSecret` continues to work without rotation support. Once shipped, the chart can drop the `dusk-secrets` volume + volumeMount entirely.
