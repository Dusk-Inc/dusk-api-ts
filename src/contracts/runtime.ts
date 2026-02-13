import type { Logger } from "pino";

export type RuntimePluginContext = {
  logger: Logger;
  setDependency: <TValue>(key: string, value: TValue) => void;
  getDependency: <TValue>(key: string) => TValue | undefined;
};

export type RuntimePlugin = {
  id: string;
  setup?: (context: RuntimePluginContext) => Promise<void> | void;
  start?: (context: RuntimePluginContext) => Promise<void> | void;
  stop?: (context: RuntimePluginContext) => Promise<void> | void;
};

