import { access, copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { constants } from "node:fs";
import path from "node:path";

import YAML from "yaml";

import type { AegisConfig } from "../types/config.js";
import { validateConfig } from "../lib/validators.js";
import { DEFAULT_CONFIG_PATH, LEGACY_REPO_CONFIG_PATH, ROOT_DIR } from "../lib/constants.js";
import { RuntimeService, type RuntimeMode } from "./runtimeService.js";

const DEFAULT_CONFIG_SOURCE = path.resolve(ROOT_DIR, "config/default.yaml");

export class ConfigService {
  private readonly runtimeService: RuntimeService;

  constructor(
    private readonly configPath = DEFAULT_CONFIG_PATH,
    runtimeService = new RuntimeService(),
  ) {
    this.runtimeService = runtimeService;
  }

  async init(): Promise<{ path: string; created: boolean }> {
    await mkdir(path.dirname(this.configPath), { recursive: true });
    try {
      await readFile(this.configPath, "utf8");
      return { path: this.configPath, created: false };
    } catch {
      if (this.configPath === DEFAULT_CONFIG_PATH && (await isReadableFile(LEGACY_REPO_CONFIG_PATH))) {
        await copyFile(LEGACY_REPO_CONFIG_PATH, this.configPath);
        return { path: this.configPath, created: true };
      }

      const defaults = await this.defaultConfig();
      await writeFile(this.configPath, YAML.stringify(defaults), "utf8");
      return { path: this.configPath, created: true };
    }
  }

  async load(options: { includeEnvOverrides?: boolean } = {}): Promise<AegisConfig> {
    const includeEnvOverrides = options.includeEnvOverrides ?? true;
    await this.init();
    const raw = await readFile(this.configPath, "utf8");
    const loaded = await this.mergeWithDefaults(YAML.parse(raw));
    const normalized = validateConfig(loaded);
    const migrated = YAML.stringify(normalized) !== raw;
    const config = structuredClone(normalized);

    if (includeEnvOverrides && process.env.OLLAMA_BASE_URL) {
      config.network.ollama_base_url = process.env.OLLAMA_BASE_URL;
    }

    if (includeEnvOverrides && process.env.RAG_API_BASE_URL) {
      config.network.rag_api_base_url = process.env.RAG_API_BASE_URL;
    }

    const validated = validateConfig(config);
    if (migrated) {
      await this.save(normalized);
    }

    return validated;
  }

  async save(config: AegisConfig): Promise<void> {
    await mkdir(path.dirname(this.configPath), { recursive: true });
    await writeFile(this.configPath, YAML.stringify(config), "utf8");
  }

  async selectModel(model: string): Promise<AegisConfig> {
    const config = await this.load({ includeEnvOverrides: false });
    config.runtime.model = model;
    await this.save(config);
    return config;
  }

  async selectModelSelectionMode(selection: AegisConfig["runtime"]["selection"]): Promise<AegisConfig> {
    const config = await this.load({ includeEnvOverrides: false });
    config.runtime.selection = selection;
    await this.save(config);
    return config;
  }

  async selectRuntimeMode(mode: RuntimeMode): Promise<AegisConfig> {
    this.runtimeService.assertSupportedMode(mode);
    const config = await this.load({ includeEnvOverrides: false });
    config.runtime.mode = mode;
    await this.save(config);
    return config;
  }

  private async defaultConfig(): Promise<AegisConfig> {
    const defaults = YAML.parse(await readFile(DEFAULT_CONFIG_SOURCE, "utf8")) as Omit<AegisConfig, "runtime"> & {
      runtime: Partial<AegisConfig["runtime"]>;
    };
    return validateConfig(await this.runtimeService.applyDefaults(defaults));
  }

  private async mergeWithDefaults(rawConfig: unknown): Promise<AegisConfig> {
    const defaults = await this.defaultConfig();
    const raw = (rawConfig ?? {}) as Partial<AegisConfig>;
    const runtimeMode = normalizeLegacyRuntimeMode(raw.runtime?.mode);

    return {
      ...defaults,
      ...raw,
      network: {
        ...defaults.network,
        ...raw.network,
        ssh_tunnel: {
          ...defaults.network.ssh_tunnel,
          ...raw.network?.ssh_tunnel,
        },
      },
      runtime: {
        ...defaults.runtime,
        ...raw.runtime,
        mode: runtimeMode ?? raw.runtime?.mode ?? defaults.runtime.mode,
        model_profiles: {
          ...defaults.runtime.model_profiles,
          ...raw.runtime?.model_profiles,
        },
      },
      rag: {
        ...defaults.rag,
        ...raw.rag,
        retrieval: {
          ...defaults.rag.retrieval,
          ...raw.rag?.retrieval,
        },
      },
      audit: {
        ...defaults.audit,
        ...raw.audit,
      },
    };
  }
}

function normalizeLegacyRuntimeMode(mode: string | undefined): AegisConfig["runtime"]["mode"] | undefined {
  if (!mode) {
    return undefined;
  }

  return mode === "native" ? "local" : (mode as AegisConfig["runtime"]["mode"]);
}

async function isReadableFile(targetPath: string): Promise<boolean> {
  try {
    await access(targetPath, constants.R_OK);
    return true;
  } catch {
    return false;
  }
}
