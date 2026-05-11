import boxen from "boxen";
import chalk from "chalk";

import { ConfigService } from "../services/configService.js";
import { RuntimeService, type RuntimeMode } from "../services/runtimeService.js";

function line(label: string, value: string): string {
  return `${chalk.bold(label.padEnd(16))}${value}`;
}

export async function runRuntimeStatus(): Promise<void> {
  const config = await new ConfigService().load();
  const status = await new RuntimeService().inspect(config);

  console.log(
    boxen(
      [
        line("Mode", status.mode),
        line("Platform", status.platform),
        line("Acceleration", status.acceleration),
        line("Native Ollama", status.nativeOllamaInstalled ? "installed" : "not found"),
      ].join("\n"),
      { padding: 1, borderColor: "cyan", title: "Aegis Runtime" },
    ),
  );
}

export async function runRuntimeUse(mode: RuntimeMode): Promise<void> {
  if (!["native", "docker"].includes(mode)) {
    throw new Error("Runtime mode must be either `native` or `docker`.");
  }

  const runtimeService = new RuntimeService();
  runtimeService.assertSupportedMode(mode);
  const config = await new ConfigService().selectRuntimeMode(mode);
  console.log(`Selected runtime mode: ${config.runtime.mode}`);
}
