import path from "node:path";
import { fileURLToPath } from "node:url";

export const APP_NAME = "Aegis CLI";
export const DEFAULT_OLLAMA_URL = process.env.OLLAMA_BASE_URL ?? "http://127.0.0.1:11434";
export const DEFAULT_RAG_API_URL = process.env.RAG_API_BASE_URL ?? "http://127.0.0.1:8088";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const ROOT_DIR = process.env.AEGIS_ROOT_DIR ?? path.resolve(__dirname, "../../../../");
export const DEFAULT_CONFIG_PATH = process.env.AEGIS_CONFIG_PATH ?? path.join(ROOT_DIR, "data/config/config.yaml");
export const DEFAULT_AUDIT_LOG_PATH =
  process.env.AEGIS_AUDIT_LOG_PATH ?? path.join(ROOT_DIR, "data/audit/audit.jsonl");
