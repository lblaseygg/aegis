import os from "node:os";
import path from "node:path";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

export const APP_NAME = "Aegis CLI";
export const DEFAULT_OLLAMA_URL = process.env.OLLAMA_BASE_URL ?? "http://127.0.0.1:11434";
export const DEFAULT_RAG_API_URL = process.env.RAG_API_BASE_URL ?? "http://127.0.0.1:8088";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const PACKAGE_ROOT = path.resolve(__dirname, "../../../");
export const WORKSPACE_ROOT = path.resolve(PACKAGE_ROOT, "../..");
export const IS_DEV_WORKSPACE =
  existsSync(path.join(WORKSPACE_ROOT, ".git")) && existsSync(path.join(WORKSPACE_ROOT, "apps/cli/package.json"));
export const ROOT_DIR = IS_DEV_WORKSPACE ? WORKSPACE_ROOT : PACKAGE_ROOT;
export const SUPPORT_DIR =
  process.env.AEGIS_SUPPORT_DIR ??
  (process.platform === "darwin"
    ? path.join(os.homedir(), "Library/Application Support/Aegis")
    : path.join(os.homedir(), ".aegis"));
export const DEFAULT_CONFIG_SOURCE = existsSync(path.join(PACKAGE_ROOT, "assets/default-config.yaml"))
  ? path.join(PACKAGE_ROOT, "assets/default-config.yaml")
  : path.join(WORKSPACE_ROOT, "config/default.yaml");
export const DEFAULT_CONFIG_PATH =
  process.env.AEGIS_CONFIG_PATH ??
  (IS_DEV_WORKSPACE ? path.join(WORKSPACE_ROOT, "data/config/config.yaml") : path.join(SUPPORT_DIR, "data/config/config.yaml"));
export const DEFAULT_AUDIT_LOG_PATH =
  process.env.AEGIS_AUDIT_LOG_PATH ??
  (IS_DEV_WORKSPACE ? path.join(WORKSPACE_ROOT, "data/audit/audit.jsonl") : path.join(SUPPORT_DIR, "data/audit/audit.jsonl"));
