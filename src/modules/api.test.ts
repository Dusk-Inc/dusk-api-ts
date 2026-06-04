import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { AppManager } from "./api.js";
import { RUNTIME_DEPENDENCY_SECRETS_ENV } from "../tokens/index.js";

describe("app_manager_api", () => {
  test("domain__app_manager_secrets_use__hydrates_runtime_env_dependency", async () => {
    const directory = await mkdtemp(join(tmpdir(), "dusk-api-topology-"));
    const secretsPath = join(directory, "secrets.env");
    await writeFile(secretsPath, "TOKEN=file-token\n", "utf8");

    const api = new AppManager({
      serviceName: "unit-test-service",
    });

    api.secrets.use({
      env: {
        DUSK_SECRETS_FILE: secretsPath,
      },
      requireReadOnlyFile: false,
    });

    try {
      await api.startRuntime();

      const runtimeEnv = api.getDependency<NodeJS.ProcessEnv>(RUNTIME_DEPENDENCY_SECRETS_ENV);
      expect(runtimeEnv?.TOKEN).toBe("file-token");
    } finally {
      await api.stopRuntime();
      await rm(directory, { recursive: true, force: true });
    }
  });
});
