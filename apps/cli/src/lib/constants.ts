import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const APP_NAME = "Aegis CLI";
export const DEFAULT_OLLAMA_URL = process.env.OLLAMA_BASE_URL ?? "http://127.0.0.1:11434";
export const DEFAULT_RAG_API_URL = process.env.RAG_API_BASE_URL ?? "http://127.0.0.1:8088";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const ROOT_DIR = process.env.AEGIS_ROOT_DIR ?? path.resolve(__dirname, "../../../../");
export const DEFAULT_SUPPORT_DIR = process.env.AEGIS_SUPPORT_DIR ?? resolveSupportDir();
export const DEFAULT_STATE_DIR = process.env.AEGIS_STATE_DIR ?? path.join(DEFAULT_SUPPORT_DIR, "state");
export const DEFAULT_DATA_DIR = path.join(DEFAULT_SUPPORT_DIR, "data");
export const LEGACY_REPO_DATA_DIR = path.join(ROOT_DIR, "data");
export const LEGACY_REPO_CONFIG_PATH = path.join(LEGACY_REPO_DATA_DIR, "config/config.yaml");
export const LEGACY_REPO_AUDIT_LOG_PATH = path.join(LEGACY_REPO_DATA_DIR, "audit/audit.jsonl");
export const DEFAULT_CONFIG_PATH = process.env.AEGIS_CONFIG_PATH ?? path.join(DEFAULT_DATA_DIR, "config/config.yaml");
export const DEFAULT_AUDIT_LOG_PATH = process.env.AEGIS_AUDIT_LOG_PATH ?? path.join(DEFAULT_DATA_DIR, "audit/audit.jsonl");

function resolveSupportDir(): string {
  const homeDir = os.homedir();

  if (process.platform === "darwin") {
    return path.join(homeDir, "Library/Application Support/Aegis");
  }

  if (process.platform === "win32") {
    return path.join(process.env.APPDATA ?? path.join(homeDir, "AppData/Roaming"), "Aegis");
  }

  return path.join(process.env.XDG_STATE_HOME ?? path.join(homeDir, ".local/state"), "aegis");
}
