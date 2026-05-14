import { constants } from "node:fs";
import { access, readdir, rm, stat, statfs } from "node:fs/promises";
import path from "node:path";

import { DEFAULT_STATE_DIR, ROOT_DIR } from "../lib/constants.js";

const LOW_SPACE_THRESHOLD_BYTES = 2 * 1024 * 1024 * 1024;
const CRITICAL_SPACE_THRESHOLD_BYTES = 512 * 1024 * 1024;

export interface StorageWarning {
  level: "warning" | "critical";
  path: string;
  freeBytes: number;
  message: string;
}

export interface CleanupSummary {
  removed: string[];
  reclaimedBytes: number;
}

export class StorageService {
  async doctorWarnings(): Promise<StorageWarning[]> {
    const warnings: StorageWarning[] = [];

    for (const target of [ROOT_DIR, DEFAULT_STATE_DIR]) {
      const warning = await inspectStorageTarget(target);
      if (warning) {
        warnings.push(warning);
      }
    }

    return dedupeWarnings(warnings);
  }

  async cleanup(options: { builds?: boolean; sessions?: boolean } = {}): Promise<CleanupSummary> {
    const cleanBuilds = options.builds ?? (!options.builds && !options.sessions);
    const cleanSessions = options.sessions ?? (!options.builds && !options.sessions);
    const removed: string[] = [];
    let reclaimedBytes = 0;

    if (cleanBuilds) {
      const buildDir = path.join(ROOT_DIR, "build");
      reclaimedBytes += await removeIfPresent(buildDir, removed);
    }

    if (cleanSessions) {
      const sessionTargets = [
        path.join(DEFAULT_STATE_DIR, "chat-session.json"),
        path.join(ROOT_DIR, "data/config/chat-session.json"),
      ];

      for (const target of sessionTargets) {
        reclaimedBytes += await removeIfPresent(target, removed);
        const tempFiles = await findTempSessionFiles(path.dirname(target));
        for (const tempFile of tempFiles) {
          reclaimedBytes += await removeIfPresent(tempFile, removed);
        }
      }
    }

    return { removed, reclaimedBytes };
  }
}

async function inspectStorageTarget(targetPath: string): Promise<StorageWarning | null> {
  try {
    const stats = await statfs(targetPath);
    const freeBytes = Number(stats.bavail) * Number(stats.bsize);
    if (freeBytes >= LOW_SPACE_THRESHOLD_BYTES) {
      return null;
    }

    const level = freeBytes < CRITICAL_SPACE_THRESHOLD_BYTES ? "critical" : "warning";
    return {
      level,
      path: targetPath,
      freeBytes,
      message:
        level === "critical"
          ? "Critically low disk space. Session persistence and local writes may fail."
          : "Low disk space. Consider running `aegis cleanup` or freeing local storage.",
    };
  } catch {
    return null;
  }
}

async function removeIfPresent(targetPath: string, removed: string[]): Promise<number> {
  try {
    await access(targetPath, constants.F_OK);
  } catch {
    return 0;
  }

  const size = await measureSize(targetPath);
  await rm(targetPath, { recursive: true, force: true });
  removed.push(targetPath);
  return size;
}

async function findTempSessionFiles(directory: string): Promise<string[]> {
  try {
    const entries = await readdir(directory);
    return entries
      .filter((entry) => entry.startsWith("chat-session.json.tmp-"))
      .map((entry) => path.join(directory, entry));
  } catch {
    return [];
  }
}

async function measureSize(targetPath: string): Promise<number> {
  try {
    const targetStat = await stat(targetPath);
    if (!targetStat.isDirectory()) {
      return targetStat.size;
    }

    let total = 0;
    for (const entry of await readdir(targetPath)) {
      total += await measureSize(path.join(targetPath, entry));
    }
    return total;
  } catch {
    return 0;
  }
}

function dedupeWarnings(warnings: StorageWarning[]): StorageWarning[] {
  const seen = new Set<string>();
  return warnings.filter((warning) => {
    const key = `${warning.level}:${warning.path}`;
    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}
