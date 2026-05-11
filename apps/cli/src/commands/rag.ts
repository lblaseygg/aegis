import chalk from "chalk";

import { ConfigService } from "../services/configService.js";
import { RagClient } from "../services/ragClient.js";

export async function runIngest(targetPath: string, collection?: string): Promise<void> {
  const config = await new ConfigService().load();
  const client = new RagClient(config.network.rag_api_base_url);
  const summary = await client.ingest(targetPath, collection ?? config.runtime.collection, true);

  console.log(chalk.cyan(`Collection: ${summary.collection}`));
  console.log(`Parsed:  ${summary.parsed}`);
  console.log(`Skipped: ${summary.skipped}`);
  console.log(`Failed:  ${summary.failed}`);
  console.log(`Chunks:  ${summary.chunks}`);
  if (summary.errors.length > 0) {
    console.log("\nErrors:");
    for (const error of summary.errors) {
      console.log(`- ${error}`);
    }
  }
}

export async function runQuery(question: string, collection?: string): Promise<void> {
  const config = await new ConfigService().load();
  const client = new RagClient(config.network.rag_api_base_url);
  const response = await client.query(
    question,
    collection ?? config.runtime.collection,
    config.runtime.model,
    config.rag.retrieval.top_k,
  );

  console.log(response.answer);
  if (response.sources.length > 0) {
    console.log("\nSources:");
    for (const source of response.sources) {
      console.log(`- ${source.file_name}#${source.chunk_index} (${source.score})`);
    }
  }
  if (response.uncertainty) {
    console.log(`\nUncertainty: ${response.uncertainty}`);
  }
}
