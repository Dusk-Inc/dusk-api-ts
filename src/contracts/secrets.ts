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
