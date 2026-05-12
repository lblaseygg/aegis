import { access } from "node:fs/promises";
import { constants } from "node:fs";

import { execa } from "execa";

import type { AegisConfig } from "../types/config.js";

export type RuntimeMode = AegisConfig["runtime"]["mode"];

export interface RuntimeStatus {
  mode: RuntimeMode;
  platform: NodeJS.Platform;
  nativeOllamaInstalled: boolean;
  acceleration: string;
}

interface RuntimeServiceOptions {
  platform?: NodeJS.Platform;
  nativeInstallDetector?: () => Promise<boolean>;
}

export class RuntimeService {
  private readonly platform: NodeJS.Platform;
  private readonly nativeInstallDetector: () => Promise<boolean>;

  constructor(options: RuntimeServiceOptions = {}) {
    this.platform = options.platform ?? process.platform;
    this.nativeInstallDetector = options.nativeInstallDetector ?? (() => detectNativeOllamaInstall(this.platform));
  }

  async recommendedMode(): Promise<RuntimeMode> {
    if (this.platform === "darwin" && (await this.nativeInstallDetector())) {
      return "native";
    }

    return "docker";
  }

  supportsNativeMode(): boolean {
    return this.platform === "darwin";
  }

  async inspect(config: AegisConfig): Promise<RuntimeStatus> {
    const nativeOllamaInstalled = await this.nativeInstallDetector();
    return {
      mode: config.runtime.mode,
      platform: this.platform,
      nativeOllamaInstalled,
      acceleration: this.describeAcceleration(config.runtime.mode),
    };
  }

  getComposeServices(config: AegisConfig): string[] {
    return config.runtime.mode === "native" && this.platform === "darwin" ? ["rag-api"] : ["ollama", "rag-api"];
  }

  getComposeEnvironment(config: AegisConfig): NodeJS.ProcessEnv {
    if (config.runtime.mode === "native" && this.platform === "darwin") {
      return {
        OLLAMA_BASE_URL: "http://host.docker.internal:11434",
      };
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
        collection: config.runtime.collection ?? "default",
        embedding_provider: config.runtime.embedding_provider ?? "hash",
      },
    };
  }

  assertSupportedMode(mode: RuntimeMode): void {
    if (mode === "native" && !this.supportsNativeMode()) {
      throw new Error("Native runtime mode is currently supported only on macOS.");
    }
  }

  private describeAcceleration(mode: RuntimeMode): string {
    if (mode === "native" && this.platform === "darwin") {
      return "Metal (native Ollama)";
    }

    return "CPU (Docker Ollama)";
  }
}

async function detectNativeOllamaInstall(platform: NodeJS.Platform): Promise<boolean> {
  if (platform !== "darwin") {
    return false;
  }

  try {
    await access("/Applications/Ollama.app", constants.R_OK);
    return true;
  } catch {
    const lookup = await execa("which", ["ollama"], { reject: false });
    return lookup.exitCode === 0;
  }
}
