import os from "node:os";
import path from "node:path";
import { access, mkdir, readdir } from "node:fs/promises";
import { constants } from "node:fs";

import chalk from "chalk";
import { execa } from "execa";

import { formatBytes, formatTimestamp } from "../lib/formatters.js";
import { ROOT_DIR } from "../lib/constants.js";
import { ConfigService } from "../services/configService.js";
import { OllamaClient } from "../services/ollamaClient.js";
import { SshTunnelService } from "../services/sshTunnelService.js";

export async function runModelsList(): Promise<void> {
  const config = await new ConfigService().load();
  await new SshTunnelService().ensureForConfig(config);
  const models = await new OllamaClient(config.network.ollama_base_url).listModels();
  if (models.length === 0) {
    console.log("No Ollama models are currently available.");
    return;
  }

  for (const model of models) {
    console.log(`${chalk.cyan(model.name)}  ${formatBytes(model.size)}  ${formatTimestamp(model.modified_at)}`);
  }
}

export async function runModelsSelect(model: string): Promise<void> {
  const config = await new ConfigService().selectModel(model);
  console.log(`Selected model: ${config.runtime.model}`);
}

export async function runModelPacksList(): Promise<void> {
  const packDir = await resolveModelPackDir();
  if (!packDir) {
    console.log("No bundled model packs are available.");
    return;
  }

  const entries = (await readdir(packDir))
    .filter((entry) => entry.endsWith(".tar.gz"))
    .sort((left, right) => left.localeCompare(right));

  if (entries.length === 0) {
    console.log("No bundled model packs are available.");
    return;
  }

  for (const entry of entries) {
    const name = entry.replace(/\.tar\.gz$/, "");
    console.log(name);
  }
}

export async function runModelPackInstall(name: string, options: { select?: string }): Promise<void> {
  const packDir = await resolveModelPackDir();
  if (!packDir) {
    throw new Error("No bundled model packs are available.");
  }

  const archivePath = path.join(packDir, `${name}.tar.gz`);
  await access(archivePath, constants.R_OK).catch(() => {
    throw new Error(`Bundled model pack not found: ${name}`);
  });

  const dataDir = await resolveAegisDataDir();
  await mkdir(dataDir, { recursive: true });
  await execa("tar", ["-C", dataDir, "-xzf", archivePath]);

  if (options.select) {
    const config = await new ConfigService().selectModel(options.select);
    console.log(`Installed bundled model pack: ${name}`);
    console.log(`Selected model: ${config.runtime.model}`);
    return;
  }

  console.log(`Installed bundled model pack: ${name}`);
}

async function resolveModelPackDir(): Promise<string | null> {
  const candidateDirs = [
    path.join(process.env.AEGIS_SUPPORT_DIR ?? path.join(os.homedir(), "Library/Application Support/Aegis"), "models/packs"),
    path.join(ROOT_DIR, "models/packs"),
  ];

  for (const candidate of candidateDirs) {
    if (await isReadableDirectory(candidate)) {
      return candidate;
    }
  }

  return null;
}

async function resolveAegisDataDir(): Promise<string> {
  const candidateDirs = [
    path.join(process.env.AEGIS_SUPPORT_DIR ?? path.join(os.homedir(), "Library/Application Support/Aegis"), "data"),
    path.join(ROOT_DIR, "data"),
  ];

  for (const candidate of candidateDirs) {
    if (await isReadableDirectory(candidate)) {
      return candidate;
    }
  }

  return candidateDirs.at(-1) ?? path.join(ROOT_DIR, "data");
}

async function isReadableDirectory(targetPath: string): Promise<boolean> {
  try {
    await access(targetPath, constants.R_OK);
    return true;
  } catch {
    return false;
  }
}
