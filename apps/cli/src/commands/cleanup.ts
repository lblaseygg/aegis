import chalk from "chalk";

import { StorageService } from "../services/storageService.js";

export async function runCleanup(options: { builds?: boolean; sessions?: boolean }): Promise<void> {
  const summary = await new StorageService().cleanup(options);

  if (summary.removed.length === 0) {
    console.log("No cleanup targets were removed.");
    return;
  }

  console.log(chalk.cyan("Removed:"));
  for (const target of summary.removed) {
    console.log(`- ${target}`);
  }
  console.log(`Reclaimed approximately ${Math.round(summary.reclaimedBytes / (1024 * 1024))}MiB.`);
}
