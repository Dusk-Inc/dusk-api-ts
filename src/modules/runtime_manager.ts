import { ERROR_CODE, ErrorModel } from "../../../dusk-core-ts/dist/index.js";
import type { Logger } from "pino";
import type { RuntimePlugin, RuntimePluginContext } from "../contracts";

export class RuntimeManager {
  private readonly logger: Logger;
  private readonly plugins: RuntimePlugin[];
  private readonly startedPluginIds: string[];
  private readonly dependencies: Map<string, unknown>;
  private started: boolean;

  constructor(logger: Logger) {
    this.logger = logger;
    this.plugins = [];
    this.startedPluginIds = [];
    this.dependencies = new Map();
    this.started = false;
  }

  use(plugin: RuntimePlugin): this {
    if (this.started) {
      throw new ErrorModel(
        ERROR_CODE.Conflict,
        "Cannot register runtime plugin after startup."
      );
    }

    const exists = this.plugins.some((item) => item.id === plugin.id);
    if (exists) {
      throw new ErrorModel(
        ERROR_CODE.Conflict,
        `Runtime plugin already registered: ${plugin.id}`
      );
    }

    this.plugins.push(plugin);
    return this;
  }

  async start(): Promise<void> {
    if (this.started) {
      return;
    }

    const context = this.buildContext();
    for (const plugin of this.plugins) {
      await plugin.setup?.(context);
      await plugin.start?.(context);
      this.startedPluginIds.push(plugin.id);
    }

    this.started = true;
  }

  async stop(): Promise<void> {
    if (!this.started) {
      return;
    }

    const context = this.buildContext();
    const startedPlugins = [...this.startedPluginIds];
    startedPlugins.reverse();

    for (const id of startedPlugins) {
      const plugin = this.plugins.find((item) => item.id === id);
      await plugin?.stop?.(context);
    }

    this.startedPluginIds.length = 0;
    this.started = false;
  }

  getDependency<TValue>(key: string): TValue | undefined {
    return this.dependencies.get(key) as TValue | undefined;
  }

  setDependency<TValue>(key: string, value: TValue): void {
    this.dependencies.set(key, value);
  }

  private buildContext(): RuntimePluginContext {
    return {
      logger: this.logger,
      setDependency: (key, value) => {
        this.setDependency(key, value);
      },
      getDependency: (key) => this.getDependency(key),
    };
  }
}
