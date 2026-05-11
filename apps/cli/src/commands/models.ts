import chalk from "chalk";

import { formatBytes, formatTimestamp } from "../lib/formatters.js";
import { ConfigService } from "../services/configService.js";
import { OllamaClient } from "../services/ollamaClient.js";

export async function runModelsList(): Promise<void> {
  const config = await new ConfigService().load();
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
