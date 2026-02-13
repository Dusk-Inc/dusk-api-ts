import { access, readFile } from "node:fs/promises";
import { constants, watch, type FSWatcher } from "node:fs";
import path from "node:path";

export type SecretSnapshot = {
  generation: number;
  values: Readonly<Record<string, string>>;
};

export type SecretRotation = {
  generation: number;
  previousGeneration: number;
  addedKeys: string[];
  removedKeys: string[];
  updatedKeys: string[];
  unchangedKeys: string[];
};

export type SecretLogger = {
  info?: (message: string, meta?: Record<string, unknown>) => void;
  warn?: (message: string, meta?: Record<string, unknown>) => void;
  error?: (message: string, meta?: Record<string, unknown>) => void;
};

export type SecretManagerOptions = {
  env?: NodeJS.ProcessEnv;
  logger?: SecretLogger;
  secretPathEnvVar?: string;
  secretPathDefault?: string;
  watchDebounceMs?: number;
  requireReadOnlyFile?: boolean;
};

const DEFAULT_SECRET_PATH_ENV_VAR = "DUSK_SECRETS_FILE";
const DEFAULT_SECRET_PATH = "/var/run/secrets/dusk/secrets.env";
const DEFAULT_WATCH_DEBOUNCE_MS = 200;

const parseSecretLine = (line: string): [string, string] | undefined => {
  const trimmed = line.trim();
  if (trimmed.length === 0 || trimmed.startsWith("#")) {
    return undefined;
  }

  const normalized = trimmed.startsWith("export ") ? trimmed.slice("export ".length) : trimmed;
  const separator = normalized.indexOf("=");
  if (separator <= 0) {
    return undefined;
  }

  const key = normalized.slice(0, separator).trim();
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) {
    return undefined;
  }

  const rawValue = normalized.slice(separator + 1).trim();
  if (rawValue.length === 0) {
    return [key, ""];
  }

  if (rawValue.startsWith("\"") && rawValue.endsWith("\"") && rawValue.length >= 2) {
    const unquoted = rawValue.slice(1, -1);
    const value = unquoted
      .replace(/\\n/g, "\n")
      .replace(/\\r/g, "\r")
      .replace(/\\t/g, "\t")
      .replace(/\\"/g, "\"")
      .replace(/\\\\/g, "\\");
    return [key, value];
  }

  if (rawValue.startsWith("'") && rawValue.endsWith("'") && rawValue.length >= 2) {
    const unquoted = rawValue.slice(1, -1);
    return [key, unquoted.replace(/\\'/g, "'").replace(/\\\\/g, "\\")];
  }

  return [key, rawValue];
};

const parseSecretsFile = (content: string): Record<string, string> => {
  const lines = content.split(/\r?\n/);
  const parsed: Record<string, string> = {};

  for (const line of lines) {
    const entry = parseSecretLine(line);
    if (!entry) {
      continue;
    }
    const [key, value] = entry;
    parsed[key] = value;
  }

  return parsed;
};

const mergeWithProcessEnv = (
  fileSecrets: Record<string, string>,
  env: NodeJS.ProcessEnv
): Record<string, string> => {
  const merged = { ...fileSecrets };
  for (const [key, value] of Object.entries(env)) {
    if (typeof value !== "string") {
      continue;
    }
    merged[key] = value;
  }
  return merged;
};

const areSecretMapsEqual = (
  left: Record<string, string>,
  right: Record<string, string>
): boolean => {
  const leftKeys = Object.keys(left);
  const rightKeys = Object.keys(right);
  if (leftKeys.length !== rightKeys.length) {
    return false;
  }

  for (const key of leftKeys) {
    if (left[key] !== right[key]) {
      return false;
    }
  }

  return true;
};

const buildRotation = (
  previousValues: Record<string, string>,
  currentValues: Record<string, string>,
  previousGeneration: number,
  generation: number
): SecretRotation => {
  const previousKeys = new Set(Object.keys(previousValues));
  const currentKeys = new Set(Object.keys(currentValues));

  const addedKeys = [...currentKeys].filter((key) => !previousKeys.has(key)).sort();
  const removedKeys = [...previousKeys].filter((key) => !currentKeys.has(key)).sort();
  const sharedKeys = [...currentKeys].filter((key) => previousKeys.has(key));
  const updatedKeys = sharedKeys
    .filter((key) => previousValues[key] !== currentValues[key])
    .sort();
  const unchangedKeys = sharedKeys
    .filter((key) => previousValues[key] === currentValues[key])
    .sort();

  return {
    generation,
    previousGeneration,
    addedKeys,
    removedKeys,
    updatedKeys,
    unchangedKeys,
  };
};

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
      throw new Error(`Required secret is missing: ${key}.`);
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

    const secretPath = this.resolveSecretPath();
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
          secretPath: this.resolveSecretPath(),
        });
      });
    }, this.watchDebounceMs);
  }

  private resolveSecretPath(): string {
    const configuredPath = this.env[this.secretPathEnvVar] ?? this.secretPathDefault;
    return path.resolve(configuredPath);
  }

  private async collectSecrets(): Promise<Record<string, string>> {
    const secretPath = this.resolveSecretPath();
    let fileSecrets: Record<string, string> = {};

    try {
      if (this.requireReadOnlyFile) {
        await this.ensureReadOnly(secretPath);
      }
      const content = await readFile(secretPath, "utf8");
      fileSecrets = parseSecretsFile(content);
    } catch (error) {
      if (this.isMissingFile(error)) {
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
      throw new Error(
        `Secrets file is writable by the current process: ${secretPath}. Expected read-only.`
      );
    } catch (error) {
      if (this.isMissingFile(error)) {
        return;
      }
      if (this.isPermissionDenied(error)) {
        return;
      }
      throw error;
    }
  }

  private isMissingFile(error: unknown): boolean {
    if (!error || typeof error !== "object") {
      return false;
    }
    const value = error as { code?: string };
    return value.code === "ENOENT";
  }

  private isPermissionDenied(error: unknown): boolean {
    if (!error || typeof error !== "object") {
      return false;
    }
    const value = error as { code?: string };
    return value.code === "EACCES";
  }
}

