import pino from "pino";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  RuntimeManager,
  SecretsPlugin,
  RUNTIME_DEPENDENCY_SECRETS_ENV,
} from "./index";

describe("runtime_manager", () => {
  test("domain__runtime_manager__starts_and_stops_plugins_in_order", async () => {
    const events: string[] = [];
    const manager = new RuntimeManager(pino({ enabled: false }));

    manager
      .use({
        id: "one",
        start: () => {
          events.push("start:one");
        },
        stop: () => {
          events.push("stop:one");
        },
      })
      .use({
        id: "two",
        start: () => {
          events.push("start:two");
        },
        stop: () => {
          events.push("stop:two");
        },
      });

    await manager.start();
    await manager.stop();

    expect(events).toEqual(["start:one", "start:two", "stop:two", "stop:one"]);
  });

  test("boundary__runtime_manager__throws_for_duplicate_plugin_id", () => {
    const manager = new RuntimeManager(pino({ enabled: false }));
    manager.use({ id: "duplicate" });

    expect(() => manager.use({ id: "duplicate" })).toThrow(
      "Runtime plugin already registered: duplicate"
    );
  });

  test("domain__runtime_manager_with_secrets_plugin__stores_runtime_env_dependency", async () => {
    const directory = await mkdtemp(join(tmpdir(), "dusk-runtime-secrets-"));
    const secretsPath = join(directory, "secrets.env");
    await writeFile(secretsPath, "DB_USER=file-user\nDB_PASS=file-pass\n", "utf8");

    const manager = new RuntimeManager(pino({ enabled: false }));
    manager.use(
      new SecretsPlugin({
        env: {
          DUSK_SECRETS_FILE: secretsPath,
          DB_PASS: "env-pass",
        },
        requireReadOnlyFile: false,
      })
    );

    try {
      await manager.start();

      const runtimeEnv = manager.getDependency<NodeJS.ProcessEnv>(RUNTIME_DEPENDENCY_SECRETS_ENV);
      expect(runtimeEnv?.DB_USER).toBe("file-user");
      expect(runtimeEnv?.DB_PASS).toBe("env-pass");
    } finally {
      await manager.stop();
      await rm(directory, { recursive: true, force: true });
    }
  });
});
