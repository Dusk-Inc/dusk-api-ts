import path from "node:path";
import type { SecretRotation } from "../contracts/index.js";

export const parseSecretLine = (line: string): [string, string] | undefined => {
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

export const parseSecretsFile = (content: string): Record<string, string> => {
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

export const mergeWithProcessEnv = (
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

export const areSecretMapsEqual = (
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

export const buildRotation = (
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

export const resolveSecretPath = (
  env: NodeJS.ProcessEnv,
  secretPathEnvVar: string,
  secretPathDefault: string
): string => {
  const configuredPath = env[secretPathEnvVar] ?? secretPathDefault;
  return path.resolve(configuredPath);
};

export const isMissingFileError = (error: unknown): boolean => {
  if (!error || typeof error !== "object") {
    return false;
  }
  const value = error as { code?: string };
  return value.code === "ENOENT";
};

export const isPermissionDeniedError = (error: unknown): boolean => {
  if (!error || typeof error !== "object") {
    return false;
  }
  const value = error as { code?: string };
  return value.code === "EACCES";
};
