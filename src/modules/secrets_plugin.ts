import type { RuntimePlugin, RuntimePluginContext } from "../contracts/index.js";
import { SecretManager, type SecretManagerOptions, type SecretSnapshot } from "./secrets.js";
import {
  RUNTIME_PLUGIN_SECRETS,
  RUNTIME_DEPENDENCY_SECRETS_MANAGER,
  RUNTIME_DEPENDENCY_SECRETS_SNAPSHOT,
  RUNTIME_DEPENDENCY_SECRETS_ENV,
} from "../tokens/index.js";
export {
  RUNTIME_PLUGIN_SECRETS,
  RUNTIME_DEPENDENCY_SECRETS_MANAGER,
  RUNTIME_DEPENDENCY_SECRETS_SNAPSHOT,
  RUNTIME_DEPENDENCY_SECRETS_ENV,
} from "../tokens/index.js";

export class SecretsPlugin implements RuntimePlugin {
  readonly id = RUNTIME_PLUGIN_SECRETS;

  private readonly config: SecretManagerOptions;
  private manager: SecretManager | null = null;
  private unsubscribe: (() => void) | null = null;

  constructor(config: SecretManagerOptions = {}) {
    this.config = config;
  }

  async start(context: RuntimePluginContext): Promise<void> {
    this.manager = new SecretManager(this.config);
    const snapshot = await this.manager.loadSecrets();

    context.setDependency(RUNTIME_DEPENDENCY_SECRETS_MANAGER, this.manager);
    context.setDependency(RUNTIME_DEPENDENCY_SECRETS_SNAPSHOT, snapshot);
    context.setDependency(RUNTIME_DEPENDENCY_SECRETS_ENV, this.mapSnapshotToEnv(snapshot));

    this.unsubscribe = this.manager.onRotate((rotation) => {
      if (!this.manager) {
        return;
      }

      const latestSnapshot = this.manager.getSnapshot();
      context.setDependency(RUNTIME_DEPENDENCY_SECRETS_SNAPSHOT, latestSnapshot);
      context.setDependency(
        RUNTIME_DEPENDENCY_SECRETS_ENV,
        this.mapSnapshotToEnv(latestSnapshot)
      );

      context.logger.info(
        {
          generation: rotation.generation,
          previousGeneration: rotation.previousGeneration,
          addedKeys: rotation.addedKeys,
          removedKeys: rotation.removedKeys,
          updatedKeys: rotation.updatedKeys,
        },
        "secret rotation detected"
      );
    });

    await this.manager.startWatching();
  }

  async stop(): Promise<void> {
    this.unsubscribe?.();
    this.unsubscribe = null;

    if (this.manager) {
      this.manager.stopWatching();
    }
    this.manager = null;
  }

  private mapSnapshotToEnv(snapshot: SecretSnapshot): NodeJS.ProcessEnv {
    return { ...snapshot.values } as NodeJS.ProcessEnv;
  }
}
