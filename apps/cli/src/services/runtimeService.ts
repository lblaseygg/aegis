import { access } from "node:fs/promises";
import { constants } from "node:fs";

import { execa } from "execa";

import type { AegisConfig } from "../types/config.js";

export type RuntimeMode = AegisConfig["runtime"]["mode"];

export interface RuntimeStatus {
  mode: RuntimeMode;
  platform: NodeJS.Platform;
  hostOllamaInstalled: boolean;
  acceleration: string;
}

interface RuntimeServiceOptions {
  platform?: NodeJS.Platform;
  hostInstallDetector?: () => Promise<boolean>;
}

export class RuntimeService {
  private readonly platform: NodeJS.Platform;
  private readonly hostInstallDetector: () => Promise<boolean>;

  constructor(options: RuntimeServiceOptions = {}) {
    this.platform = options.platform ?? process.platform;
    this.hostInstallDetector = options.hostInstallDetector ?? (() => detectHostOllamaInstall(this.platform));
  }

  async recommendedMode(): Promise<RuntimeMode> {
    if (await this.hostInstallDetector()) {
      return "local";
    }

    return "docker";
  }

  supportsLocalMode(): boolean {
    return this.platform === "darwin" || this.platform === "linux" || this.platform === "win32";
  }

  async inspect(config: AegisConfig): Promise<RuntimeStatus> {
    const hostOllamaInstalled = await this.hostInstallDetector();
    return {
      mode: config.runtime.mode,
      platform: this.platform,
      hostOllamaInstalled,
      acceleration: this.describeAcceleration(config.runtime.mode),
    };
  }

  getComposeServices(config: AegisConfig): string[] {
    if (config.runtime.mode === "docker") {
      return ["ollama", "rag-api"];
    }

    if (config.runtime.mode === "local") {
      return ["rag-api"];
    }

    return [];
  }

  getComposeEnvironment(config: AegisConfig): NodeJS.ProcessEnv {
    if (config.runtime.mode === "local" && this.platform === "darwin") {
      return {
        OLLAMA_BASE_URL: "http://host.docker.internal:11434",
      };
    }

    if (config.runtime.mode === "local") {
      return {
        OLLAMA_BASE_URL: "http://127.0.0.1:11434",
      };
    }

    if (config.runtime.mode === "remote") {
      return {};
    }

    return {
      OLLAMA_BASE_URL: "http://ollama:11434",
    };
  }

  async applyDefaults(config: Omit<AegisConfig, "runtime"> & { runtime: Partial<AegisConfig["runtime"]> }): Promise<AegisConfig> {
    const mode = config.runtime.mode ?? (await this.recommendedMode());
    return {
      ...config,
      runtime: {
        mode,
        model: config.runtime.model ?? "gemma3:4b",
        selection: config.runtime.selection ?? "auto",
        model_profiles: {
          fast_general: config.runtime.model_profiles?.fast_general ?? "phi4-mini",
          long_running: config.runtime.model_profiles?.long_running ?? "qwen3:8b",
          coding_optimized: config.runtime.model_profiles?.coding_optimized ?? "qwen2.5-coder:7b",
          coding_fast: config.runtime.model_profiles?.coding_fast ?? "qwen2.5-coder:3b",
          coding_strong: config.runtime.model_profiles?.coding_strong ?? "qwen2.5-coder:7b",
        },
        collection: config.runtime.collection ?? "default",
        embedding_provider: config.runtime.embedding_provider ?? "hash",
      },
      network: {
        ...config.network,
        ssh_tunnel: {
          enabled: config.network.ssh_tunnel?.enabled ?? false,
          host: config.network.ssh_tunnel?.host ?? "",
          use_ssh_config_forwards: config.network.ssh_tunnel?.use_ssh_config_forwards ?? false,
          remote_ollama_url: config.network.ssh_tunnel?.remote_ollama_url ?? "http://127.0.0.1:11434",
          remote_rag_api_url: config.network.ssh_tunnel?.remote_rag_api_url ?? "http://127.0.0.1:8088",
        },
      },
    };
  }

  assertSupportedMode(mode: RuntimeMode): void {
    if (mode === "local" && !this.supportsLocalMode()) {
      throw new Error("Local runtime mode is not supported on this platform.");
    }
  }

  private describeAcceleration(mode: RuntimeMode): string {
    if (mode === "local" && this.platform === "darwin") {
      return "Metal (host Ollama)";
    }

    if (mode === "local") {
      return "Host Ollama";
    }

    if (mode === "remote") {
      return "Remote Ollama";
    }

    return "CPU (Docker Ollama)";
  }
}

async function detectHostOllamaInstall(platform: NodeJS.Platform): Promise<boolean> {
  try {
    if (platform === "darwin") {
      await access("/Applications/Ollama.app", constants.R_OK);
      return true;
    }
  } catch {
    // Fall through to CLI lookup.
  }

  const lookup = await execa(platform === "win32" ? "where" : "which", ["ollama"], { reject: false });
  return lookup.exitCode === 0;
}
