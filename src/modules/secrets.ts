import { access, readFile, stat } from "node:fs/promises";
import { constants, watch, type FSWatcher } from "node:fs";
import path from "node:path";
import { ERROR_CODE, ErrorModel } from "../../../dusk-core-ts/dist/index.js";
import {
  areSecretMapsEqual,
  buildRotation,
  isMissingFileError,
  isPermissionDeniedError,
  mergeWithProcessEnv,
  parseSecretsFile,
  resolveSecretPath,
} from "../functions/secrets";
import type {
  SecretLogger,
  SecretManagerOptions,
  SecretRotation,
  SecretSnapshot,
} from "../contracts";
import {
  DEFAULT_SECRET_PATH,
  DEFAULT_SECRET_PATH_ENV_VAR,
  DEFAULT_WATCH_DEBOUNCE_MS,
} from "../tokens";
export type {
  SecretSnapshot,
  SecretRotation,
  SecretLogger,
  SecretManagerOptions,
} from "../contracts";

type SecretRotationListener = (rotation: SecretRotation) => void;

export class SecretManager {
  private readonly env: NodeJS.ProcessEnv;
  private readonly logger?: SecretLogger;
  private readonly secretPathEnvVar: string;
  private readonly secretPathDefault: string;
  private readonly watchDebounceMs: number;
  private readonly requireReadOnlyFile: boolean;
  private readonly listeners: Set<SecretRotationListener>;
  private watcher: FSWatcher | null;
  private watchTimer: NodeJS.Timeout | null;
  private snapshot: SecretSnapshot;

  constructor(options: SecretManagerOptions = {}) {
    this.env = options.env ?? process.env;
    this.logger = options.logger;
    this.secretPathEnvVar = options.secretPathEnvVar ?? DEFAULT_SECRET_PATH_ENV_VAR;
    this.secretPathDefault = options.secretPathDefault ?? DEFAULT_SECRET_PATH;
    this.watchDebounceMs = options.watchDebounceMs ?? DEFAULT_WATCH_DEBOUNCE_MS;
    this.requireReadOnlyFile = options.requireReadOnlyFile ?? true;
    this.listeners = new Set<SecretRotationListener>();
    this.watcher = null;
    this.watchTimer = null;
    this.snapshot = {
      generation: 0,
      values: Object.freeze({}),
    };
  }

  getSnapshot(): SecretSnapshot {
    return this.snapshot;
  }

  getSecret(key: string): string | undefined {
    return this.snapshot.values[key];
  }

  getRequiredSecret(key: string): string {
    const value = this.getSecret(key);
    if (!value) {
      throw new ErrorModel(ERROR_CODE.NotFound, `Required secret is missing: ${key}.`);
    }
    return value;
  }

  getAllSecrets(): Readonly<Record<string, string>> {
    return this.snapshot.values;
  }

  onRotate(listener: SecretRotationListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  async loadSecrets(): Promise<SecretSnapshot> {
    return this.refreshSecrets();
  }

  async ensureFreshSecretsFile(): Promise<void> {
    const snapshot = this.snapshot.generation > 0 ? this.snapshot : await this.loadSecrets();
    const secrets = snapshot.values;
    const requireFile = (secrets.DUSK_SECRETS_REQUIRE_FILE ?? "true").toLowerCase() === "true";
    if (!requireFile) {
      return;
    }

    const secretPath = resolveSecretPath(this.env, this.secretPathEnvVar, this.secretPathDefault);
    let fileStats;
    try {
      fileStats = await stat(secretPath);
    } catch {
      throw new ErrorModel(
        ERROR_CODE.DependencyFailure,
        `Required secrets file is missing: ${secretPath}.`
      );
    }

    const parsedMaxAge = Number.parseInt(secrets.DUSK_SECRETS_MAX_AGE_SEC ?? "300", 10);
    const maxAgeSec = Number.isFinite(parsedMaxAge) && parsedMaxAge > 0 ? parsedMaxAge : 300;
    const ageSec = Math.floor((Date.now() - fileStats.mtimeMs) / 1000);

    if (ageSec > maxAgeSec) {
      throw new ErrorModel(
        ERROR_CODE.DependencyFailure,
        `Secrets file is stale (${ageSec}s old): ${secretPath}.`
      );
    }
  }

  async refreshSecrets(): Promise<SecretSnapshot> {
    const values = await this.collectSecrets();
    const previousValues = this.snapshot.values as Record<string, string>;
    const isSame = areSecretMapsEqual(previousValues, values);
    if (isSame) {
      return this.snapshot;
    }

    const generation = this.snapshot.generation + 1;
    this.snapshot = {
      generation,
      values: Object.freeze({ ...values }),
    };

    if (generation > 1) {
      const rotation = buildRotation(previousValues, values, generation - 1, generation);
      this.logger?.info?.("Secret rotation detected.", {
        generation: rotation.generation,
        previousGeneration: rotation.previousGeneration,
        addedKeys: rotation.addedKeys,
        removedKeys: rotation.removedKeys,
        updatedKeys: rotation.updatedKeys,
      });
      for (const listener of this.listeners) {
        listener(rotation);
      }
    }

    return this.snapshot;
  }

  async startWatching(): Promise<void> {
    if (this.watcher) {
      return;
    }

    const secretPath = resolveSecretPath(this.env, this.secretPathEnvVar, this.secretPathDefault);
    const directory = path.dirname(secretPath);
    const expectedFileName = path.basename(secretPath);

    this.watcher = watch(directory, { persistent: true }, (_eventType, fileName) => {
      if (typeof fileName !== "string" || fileName.length === 0) {
        this.scheduleRefresh();
        return;
      }

      if (fileName === expectedFileName) {
        this.scheduleRefresh();
      }
    });
  }

  stopWatching(): void {
    if (this.watchTimer) {
      clearTimeout(this.watchTimer);
      this.watchTimer = null;
    }

    if (this.watcher) {
      this.watcher.close();
      this.watcher = null;
    }
  }

  private scheduleRefresh(): void {
    if (this.watchTimer) {
      clearTimeout(this.watchTimer);
    }

    this.watchTimer = setTimeout(() => {
      this.watchTimer = null;
      void this.refreshSecrets().catch((error) => {
        this.logger?.warn?.("Failed to refresh secrets after file update.", {
          error: error instanceof Error ? error.message : "unknown",
          secretPath: resolveSecretPath(this.env, this.secretPathEnvVar, this.secretPathDefault),
        });
      });
    }, this.watchDebounceMs);
  }

  private async collectSecrets(): Promise<Record<string, string>> {
    const secretPath = resolveSecretPath(this.env, this.secretPathEnvVar, this.secretPathDefault);
    let fileSecrets: Record<string, string> = {};

    try {
      if (this.requireReadOnlyFile) {
        await this.ensureReadOnly(secretPath);
      }
      const content = await readFile(secretPath, "utf8");
      fileSecrets = parseSecretsFile(content);
    } catch (error) {
      if (isMissingFileError(error)) {
        this.logger?.warn?.("Secrets file is missing. Falling back to environment values only.", {
          secretPath,
        });
      } else {
        throw error;
      }
    }

    return mergeWithProcessEnv(fileSecrets, this.env);
  }

  private async ensureReadOnly(secretPath: string): Promise<void> {
    try {
      await access(secretPath, constants.W_OK);
      throw new ErrorModel(
        ERROR_CODE.Forbidden,
        `Secrets file is writable by the current process: ${secretPath}. Expected read-only.`
      );
    } catch (error) {
      if (isMissingFileError(error)) {
        return;
      }
      if (isPermissionDeniedError(error)) {
        return;
      }
      throw error;
    }
  }
}
