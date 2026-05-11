import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import YAML from "yaml";

import type { AegisConfig } from "../types/config.js";
import { validateConfig } from "../lib/validators.js";
import { DEFAULT_CONFIG_PATH, ROOT_DIR } from "../lib/constants.js";

const DEFAULT_CONFIG_SOURCE = path.resolve(ROOT_DIR, "config/default.yaml");

export class ConfigService {
  constructor(private readonly configPath = DEFAULT_CONFIG_PATH) {}

  async init(): Promise<{ path: string; created: boolean }> {
    await mkdir(path.dirname(this.configPath), { recursive: true });
    try {
      await readFile(this.configPath, "utf8");
      return { path: this.configPath, created: false };
    } catch {
      const defaults = await readFile(DEFAULT_CONFIG_SOURCE, "utf8");
      await writeFile(this.configPath, defaults, "utf8");
      return { path: this.configPath, created: true };
    }
  }

  async load(): Promise<AegisConfig> {
    await this.init();
    const raw = await readFile(this.configPath, "utf8");
    const config = validateConfig(YAML.parse(raw));

    if (process.env.OLLAMA_BASE_URL) {
      config.network.ollama_base_url = process.env.OLLAMA_BASE_URL;
    }

    if (process.env.RAG_API_BASE_URL) {
      config.network.rag_api_base_url = process.env.RAG_API_BASE_URL;
    }

    return validateConfig(config);
  }

  async save(config: AegisConfig): Promise<void> {
    await mkdir(path.dirname(this.configPath), { recursive: true });
    await writeFile(this.configPath, YAML.stringify(config), "utf8");
  }

  async selectModel(model: string): Promise<AegisConfig> {
    const config = await this.load();
    config.runtime.model = model;
    await this.save(config);
    return config;
  }
}
