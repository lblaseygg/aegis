import boxen from "boxen";
import chalk from "chalk";

import { ConfigService } from "../services/configService.js";
import { OllamaClient } from "../services/ollamaClient.js";
import { RagClient } from "../services/ragClient.js";

function line(label: string, value: string): string {
  return `${chalk.bold(label.padEnd(14))}${value}`;
}

export async function runDoctor(): Promise<void> {
  const config = await new ConfigService().load();
  const ollama = new OllamaClient(config.network.ollama_base_url);
  const rag = new RagClient(config.network.rag_api_base_url);

  const [ollamaStatus, ragStatus] = await Promise.all([
    ollama.health(),
    rag.health().catch(() => null),
  ]);

  const output = [
    line("Offline mode", String(config.offline_mode)),
    line("Ollama", ollamaStatus),
    line("RAG API", ragStatus ? ragStatus.status : "offline"),
    line("ChromaDB", ragStatus ? ragStatus.chroma : "unknown"),
    line("Model", config.runtime.model),
    line("Collection", config.runtime.collection),
  ].join("\n");

  console.log(boxen(output, { padding: 1, borderColor: "cyan", title: "Aegis Doctor" }));
}
