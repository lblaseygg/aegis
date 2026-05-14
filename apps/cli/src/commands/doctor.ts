import boxen from "boxen";
import chalk from "chalk";

import { ConfigService } from "../services/configService.js";
import { OllamaClient } from "../services/ollamaClient.js";
import { RagClient } from "../services/ragClient.js";
import { RuntimeService } from "../services/runtimeService.js";
import { SshTunnelService } from "../services/sshTunnelService.js";
import { StorageService } from "../services/storageService.js";

function line(label: string, value: string): string {
  return `${chalk.bold(label.padEnd(14))}${value}`;
}

export async function runDoctor(): Promise<void> {
  const config = await new ConfigService().load();
  await new SshTunnelService().ensureForConfig(config);
  const runtime = await new RuntimeService().inspect(config);
  const ollama = new OllamaClient(config.network.ollama_base_url);
  const rag = new RagClient(config.network.rag_api_base_url);

  const [ollamaStatus, ragStatus] = await Promise.all([
    ollama.health(),
    rag.health().catch(() => null),
  ]);
  const storageWarnings = await new StorageService().doctorWarnings();

  const output = [
    line("Offline mode", String(config.offline_mode)),
    line("Runtime", runtime.mode),
    line("Acceleration", runtime.acceleration),
    line("Host Ollama", runtime.hostOllamaInstalled ? "installed" : "not found"),
    line("Ollama", ollamaStatus),
    line("RAG API", ragStatus ? ragStatus.status : "offline"),
    line("ChromaDB", ragStatus ? ragStatus.chroma : "unknown"),
    line("Model", config.runtime.model),
    line("Collection", config.runtime.collection),
    ...storageWarnings.map((warning, index) =>
      line(
        index === 0 ? "Storage" : "",
        `${warning.level === "critical" ? "critical" : "low"} at ${warning.path} (${formatMiB(warning.freeBytes)} free)`,
      ),
    ),
  ].join("\n");

  console.log(boxen(output, { padding: 1, borderColor: "cyan", title: "Aegis Doctor" }));

  if (storageWarnings.length > 0) {
    console.log("");
    for (const warning of storageWarnings) {
      console.log(chalk.yellow(`Warning: ${warning.message}`));
    }
  }
}

function formatMiB(bytes: number): string {
  return `${Math.round(bytes / (1024 * 1024))}MiB`;
}
