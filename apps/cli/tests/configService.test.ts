import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, test } from "vitest";
import YAML from "yaml";

import { ConfigService } from "../src/services/configService.js";
import { RuntimeService } from "../src/services/runtimeService.js";

const tempDirs: string[] = [];

afterEach(async () => {
  delete process.env.OLLAMA_BASE_URL;
  delete process.env.RAG_API_BASE_URL;

  while (tempDirs.length > 0) {
    const directory = tempDirs.pop();
    if (directory) {
      await rm(directory, { recursive: true, force: true });
    }
  }
});

describe("ConfigService", () => {
  test("does not persist env override endpoints back into config saves", async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), "aegis-config-service-"));
    tempDirs.push(tempDir);
    const configPath = path.join(tempDir, "config.yaml");
    const service = new ConfigService(
      configPath,
      new RuntimeService({
        platform: "darwin",
        hostInstallDetector: async () => true,
      }),
    );

    await service.init();

    process.env.OLLAMA_BASE_URL = "http://127.0.0.1:11435";
    process.env.RAG_API_BASE_URL = "http://127.0.0.1:18088";

    await service.selectModelSelectionMode("auto");

    const persisted = YAML.parse(await readFile(configPath, "utf8")) as {
      network: { ollama_base_url: string; rag_api_base_url: string };
    };

    expect(persisted.network.ollama_base_url).toBe("http://127.0.0.1:11434");
    expect(persisted.network.rag_api_base_url).toBe("http://127.0.0.1:8088");
  });
});
