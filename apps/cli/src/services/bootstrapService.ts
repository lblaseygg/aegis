import path from "node:path";
import os from "node:os";
import { access, copyFile, cp, mkdir, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { constants } from "node:fs";

import { execa } from "execa";
import packageJson from "../../package.json" with { type: "json" };
import { IS_DEV_WORKSPACE, SUPPORT_DIR } from "../lib/constants.js";

const DEFAULT_BUNDLE_URL = process.env.AEGIS_BOOTSTRAP_BUNDLE_URL;
const DEFAULT_BUNDLE_PATH = process.env.AEGIS_BOOTSTRAP_BUNDLE_PATH;

interface BootstrapTemplateMap {
  [key: string]: string;
}

export class BootstrapService {
  constructor(
    private readonly supportDir = SUPPORT_DIR,
    private readonly bundlePath = DEFAULT_BUNDLE_PATH,
    private readonly bundleUrl = DEFAULT_BUNDLE_URL,
  ) {}

  isManagedInstall(): boolean {
    return !IS_DEV_WORKSPACE && process.platform === "darwin";
  }

  async ensureReady(): Promise<void> {
    if (!this.isManagedInstall()) {
      return;
    }

    if (!(await this.isInstalled())) {
      await this.install();
    }

    await this.startServices();
  }

  async startServices(): Promise<void> {
    if (!this.isManagedInstall()) {
      return;
    }

    const launchdDir = path.join(this.supportDir, "launchd");
    const ollamaPlist = path.join(launchdDir, "com.aegis.ollama.plist");
    const ragApiPlist = path.join(launchdDir, "com.aegis.rag-api.plist");
    const templatesDir = path.join(this.supportDir, "launch-agents");

    try {
      await Promise.all([access(ollamaPlist, constants.R_OK), access(ragApiPlist, constants.R_OK)]);
    } catch {
      await this.installLaunchAgents();
    }

    await this.bootstrapLaunchAgent(ollamaPlist, "com.aegis.ollama");
    await this.bootstrapLaunchAgent(ragApiPlist, "com.aegis.rag-api");
    await this.waitForService("http://127.0.0.1:11434/api/tags", "Embedded Ollama");
    await this.waitForService("http://127.0.0.1:8088/health", "Embedded RAG API");
  }

  async stopServices(): Promise<void> {
    if (!this.isManagedInstall()) {
      return;
    }

    const launchdDir = path.join(this.supportDir, "launchd");
    const uid = currentUid();
    await execa("launchctl", ["bootout", `gui/${uid}`, path.join(launchdDir, "com.aegis.ollama.plist")], {
      reject: false,
    });
    await execa("launchctl", ["bootout", `gui/${uid}`, path.join(launchdDir, "com.aegis.rag-api.plist")], {
      reject: false,
    });
  }

  async install(): Promise<void> {
    if (!this.isManagedInstall()) {
      throw new Error("The npm bootstrap installer is currently supported only for packaged macOS installs.");
    }

    const source = this.bundlePath ?? this.bundleUrl;
    if (!source) {
      throw new Error(
        "No runtime bundle source is configured. Set AEGIS_BOOTSTRAP_BUNDLE_PATH or AEGIS_BOOTSTRAP_BUNDLE_URL before running `aegis`.",
      );
    }

    const tmpRoot = await mkdtemp(path.join(os.tmpdir(), "aegis-bootstrap-"));
    const archivePath = path.join(tmpRoot, "runtime-bundle.tar.gz");
    const extractDir = path.join(tmpRoot, "bundle");

    try {
      await this.acquireBundle(source, archivePath);
      await mkdir(extractDir, { recursive: true });
      await execa("tar", ["-xzf", archivePath, "-C", extractDir]);
      await this.stageBundle(extractDir);
      await this.installConfig();
      await this.importBundledModels();
      await this.installLaunchAgents();
      await writeFile(path.join(this.supportDir, ".installed-version"), packageJson.version, "utf8");
    } finally {
      await rm(tmpRoot, { recursive: true, force: true });
    }
  }

  private async isInstalled(): Promise<boolean> {
    const versionPath = path.join(this.supportDir, ".installed-version");
    const ollamaPath = path.join(this.supportDir, "runtime/ollama/Ollama.app/Contents/MacOS/Ollama");
    const ragPython = path.join(this.supportDir, "runtime/python/bin/python3");

    try {
      const [installedVersion, ollamaStats, pythonStats] = await Promise.all([
        readFile(versionPath, "utf8"),
        stat(ollamaPath),
        stat(ragPython),
      ]);
      return installedVersion.trim() === packageJson.version && ollamaStats.isFile() && pythonStats.isFile();
    } catch {
      return false;
    }
  }

  private async acquireBundle(source: string, archivePath: string): Promise<void> {
    if (isUrl(source)) {
      const response = await fetch(source);
      if (!response.ok || !response.body) {
        throw new Error(`Failed to download runtime bundle from ${source}: ${response.status} ${response.statusText}`);
      }

      const body = Buffer.from(await response.arrayBuffer());
      await writeFile(archivePath, body);
      return;
    }

    await copyFile(path.resolve(source), archivePath);
  }

  private async stageBundle(extractDir: string): Promise<void> {
    await mkdir(this.supportDir, { recursive: true });
    await mkdir(path.join(this.supportDir, "runtime"), { recursive: true });
    await mkdir(path.join(this.supportDir, "templates"), { recursive: true });
    await mkdir(path.join(this.supportDir, "launch-agents"), { recursive: true });
    await mkdir(path.join(this.supportDir, "data", "config"), { recursive: true });
    await mkdir(path.join(this.supportDir, "data", "audit"), { recursive: true });
    await mkdir(path.join(this.supportDir, "data", "chroma"), { recursive: true });
    await mkdir(path.join(this.supportDir, "data", "documents"), { recursive: true });
    await mkdir(path.join(this.supportDir, "data", "ollama", "home"), { recursive: true });
    await mkdir(path.join(this.supportDir, "logs"), { recursive: true });
    await mkdir(path.join(this.supportDir, "launchd"), { recursive: true });

    await cp(path.join(extractDir, "runtime"), path.join(this.supportDir, "runtime"), {
      recursive: true,
      force: true,
    });
    await cp(path.join(extractDir, "templates"), path.join(this.supportDir, "templates"), {
      recursive: true,
      force: true,
    });
    await cp(path.join(extractDir, "launch-agents"), path.join(this.supportDir, "launch-agents"), {
      recursive: true,
      force: true,
    });

    try {
      await access(path.join(extractDir, "models"), constants.R_OK);
      await cp(path.join(extractDir, "models"), path.join(this.supportDir, "models"), {
        recursive: true,
        force: true,
      });
    } catch {
      // Optional.
    }
  }

  private async installConfig(): Promise<void> {
    const configPath = path.join(this.supportDir, "data/config/config.yaml");
    try {
      await access(configPath, constants.R_OK);
    } catch {
      await copyFile(path.join(this.supportDir, "templates/default-config.yaml"), configPath);
    }
  }

  private async importBundledModels(): Promise<void> {
    const storeArchive = path.join(this.supportDir, "models/default-model-store.tar.gz");
    try {
      await access(storeArchive, constants.R_OK);
    } catch {
      return;
    }

    const modelsDir = path.join(this.supportDir, "data/ollama/models");
    try {
      await access(modelsDir, constants.R_OK);
      return;
    } catch {
      await execa("tar", ["-xzf", storeArchive, "-C", path.join(this.supportDir, "data")]);
    }
  }

  private async installLaunchAgents(): Promise<void> {
    const launchdDir = path.join(this.supportDir, "launchd");
    const logDir = path.join(this.supportDir, "logs");
    const templatesDir = path.join(this.supportDir, "launch-agents");

    await this.renderTemplate(
      path.join(templatesDir, "com.aegis.ollama.plist.template"),
      path.join(launchdDir, "com.aegis.ollama.plist"),
      {
        "__SUPPORT_DIR__": this.supportDir,
        "__OLLAMA_BIN__": path.join(this.supportDir, "runtime/ollama/Ollama.app/Contents/MacOS/Ollama"),
        "__OLLAMA_HOME__": path.join(this.supportDir, "data/ollama/home"),
        "__OLLAMA_MODELS__": path.join(this.supportDir, "data/ollama/models"),
        "__LOG_DIR__": logDir,
      },
    );

    await this.renderTemplate(
      path.join(templatesDir, "com.aegis.rag-api.plist.template"),
      path.join(launchdDir, "com.aegis.rag-api.plist"),
      {
        "__SUPPORT_DIR__": this.supportDir,
        "__PYTHON_BIN__": path.join(this.supportDir, "runtime/python/bin/python3"),
        "__PYTHONPATH__": [
          path.join(this.supportDir, "runtime/python/site-packages"),
          path.join(this.supportDir, "runtime/rag-api"),
        ].join(":"),
        "__LOG_DIR__": logDir,
      },
    );

    await this.startServices();
  }

  private async renderTemplate(templatePath: string, outputPath: string, map: BootstrapTemplateMap): Promise<void> {
    let rendered = await readFile(templatePath, "utf8");
    for (const [key, value] of Object.entries(map)) {
      rendered = rendered.replaceAll(key, value);
    }

    await writeFile(outputPath, rendered, "utf8");
  }

  private async bootstrapLaunchAgent(plistPath: string, label: string): Promise<void> {
    const uid = currentUid();
    await execa("launchctl", ["bootout", `gui/${uid}`, plistPath], { reject: false });
    await execa("launchctl", ["bootstrap", `gui/${uid}`, plistPath]);
    await execa("launchctl", ["kickstart", "-k", `gui/${uid}/${label}`], { reject: false });
  }

  private async waitForService(url: string, label: string): Promise<void> {
    for (let attempt = 0; attempt < 60; attempt += 1) {
      try {
        const response = await fetch(url);
        if (response.ok) {
          return;
        }
      } catch {
        // Keep polling.
      }

      await sleep(1000);
    }

    throw new Error(`${label} did not become ready after bootstrap.`);
  }
}

function isUrl(value: string): boolean {
  return value.startsWith("http://") || value.startsWith("https://");
}

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function currentUid(): number {
  const uid = process.getuid?.();
  if (uid === undefined) {
    throw new Error("macOS bootstrap requires process.getuid()");
  }

  return uid;
}
