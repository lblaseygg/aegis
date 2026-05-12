import { cp, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const packageRoot = path.resolve(__dirname, "..");
const workspaceRoot = path.resolve(packageRoot, "../..");

await mkdir(path.join(packageRoot, "assets"), { recursive: true });
await cp(path.join(workspaceRoot, "config/default.yaml"), path.join(packageRoot, "assets/default-config.yaml"));
