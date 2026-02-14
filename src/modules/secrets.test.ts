import { chmod, mkdtemp, rm, utimes, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { SecretManager } from "./secrets";

const makeTempSecretsFile = async (content: string): Promise<{ dir: string; filePath: string }> => {
  const dir = await mkdtemp(join(tmpdir(), "dusk-secrets-"));
  const filePath = join(dir, "secrets.env");
  await writeFile(filePath, content, "utf8");
  return { dir, filePath };
};

describe("secret_manager", () => {
  test("domain__load_secrets__merges_file_and_env_with_env_precedence", async () => {
    const { dir, filePath } = await makeTempSecretsFile([
      "DB_USER=file-user",
      "DB_PASS=file-pass",
      "DB_HOST=file-host",
    ].join("\n"));

    try {
      const manager = new SecretManager({
        env: {
          DUSK_SECRETS_FILE: filePath,
          DB_PASS: "env-pass",
        },
        requireReadOnlyFile: false,
      });

      const snapshot = await manager.loadSecrets();

      expect(snapshot.generation).toBe(1);
      expect(manager.getSecret("DB_USER")).toBe("file-user");
      expect(manager.getSecret("DB_HOST")).toBe("file-host");
      expect(manager.getSecret("DB_PASS")).toBe("env-pass");
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  test("boundary__load_secrets__falls_back_to_env_when_file_is_missing", async () => {
    const manager = new SecretManager({
      env: {
        DUSK_SECRETS_FILE: "/tmp/does-not-exist.env",
        DB_USER: "env-only-user",
      },
      requireReadOnlyFile: false,
    });

    const snapshot = await manager.loadSecrets();

    expect(snapshot.generation).toBe(1);
    expect(manager.getSecret("DB_USER")).toBe("env-only-user");
  });

  test("boundary__load_secrets__throws_when_secret_file_is_writable_and_read_only_is_required", async () => {
    const { dir, filePath } = await makeTempSecretsFile("DB_USER=file-user");

    try {
      await chmod(filePath, 0o600);
      const manager = new SecretManager({
        env: {
          DUSK_SECRETS_FILE: filePath,
        },
        requireReadOnlyFile: true,
      });

      await expect(manager.loadSecrets()).rejects.toThrow(
        "Secrets file is writable by the current process"
      );
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  test("domain__refresh_secrets__increments_generation_and_emits_rotation_without_secret_values", async () => {
    const { dir, filePath } = await makeTempSecretsFile("DB_USER=user-a\nDB_PASS=pass-a");

    try {
      const manager = new SecretManager({
        env: {
          DUSK_SECRETS_FILE: filePath,
        },
        requireReadOnlyFile: false,
      });

      await manager.loadSecrets();

      const observed = new Promise<{
        generation: number;
        previousGeneration: number;
        updatedKeys: string[];
      }>((resolve) => {
        manager.onRotate((rotation) => {
          resolve({
            generation: rotation.generation,
            previousGeneration: rotation.previousGeneration,
            updatedKeys: rotation.updatedKeys,
          });
        });
      });

      await writeFile(filePath, "DB_USER=user-b\nDB_PASS=pass-a", "utf8");
      const next = await manager.refreshSecrets();
      const rotation = await observed;

      expect(next.generation).toBe(2);
      expect(rotation.generation).toBe(2);
      expect(rotation.previousGeneration).toBe(1);
      expect(rotation.updatedKeys).toEqual(["DB_USER"]);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  test("domain__watching__refreshes_generation_when_secrets_file_rotates", async () => {
    const { dir, filePath } = await makeTempSecretsFile("DB_USER=user-a");
    let manager: SecretManager | null = null;

    try {
      manager = new SecretManager({
        env: {
          DUSK_SECRETS_FILE: filePath,
        },
        watchDebounceMs: 20,
        requireReadOnlyFile: false,
      });
      if (!manager) {
        throw new Error("Expected SecretManager to be initialized.");
      }
      const activeManager = manager;

      await activeManager.loadSecrets();

      const rotated = new Promise<number>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error("Timed out waiting for secret rotation."));
        }, 2000);

        activeManager.onRotate((rotation) => {
          clearTimeout(timeout);
          resolve(rotation.generation);
        });
      });

      await activeManager.startWatching();
      await writeFile(filePath, "DB_USER=user-b", "utf8");

      const generation = await rotated;
      expect(generation).toBe(2);
    } finally {
      manager?.stopWatching();
      await rm(dir, { recursive: true, force: true });
    }
  });

  test("complement__ensure_fresh_secrets_file__throws_when_file_is_missing_and_required", async () => {
    const manager = new SecretManager({
      env: {
        DUSK_SECRETS_FILE: "/tmp/does-not-exist.env",
        DUSK_SECRETS_REQUIRE_FILE: "true",
      },
      requireReadOnlyFile: false,
    });

    await expect(manager.ensureFreshSecretsFile()).rejects.toThrow(
      "Required secrets file is missing"
    );
  });

  test("boundary__ensure_fresh_secrets_file__throws_when_file_is_stale", async () => {
    const { dir, filePath } = await makeTempSecretsFile("DB_USER=file-user");

    try {
      const oldDate = new Date(Date.now() - 10 * 60 * 1000);
      await utimes(filePath, oldDate, oldDate);
      const manager = new SecretManager({
        env: {
          DUSK_SECRETS_FILE: filePath,
          DUSK_SECRETS_REQUIRE_FILE: "true",
          DUSK_SECRETS_MAX_AGE_SEC: "60",
        },
        requireReadOnlyFile: false,
      });

      await expect(manager.ensureFreshSecretsFile()).rejects.toThrow(
        "Secrets file is stale"
      );
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  test("domain__ensure_fresh_secrets_file__skips_when_require_file_is_false", async () => {
    const manager = new SecretManager({
      env: {
        DUSK_SECRETS_FILE: "/tmp/does-not-exist.env",
        DUSK_SECRETS_REQUIRE_FILE: "false",
      },
      requireReadOnlyFile: false,
    });

    await expect(manager.ensureFreshSecretsFile()).resolves.toBeUndefined();
  });
});
