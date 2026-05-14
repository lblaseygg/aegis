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
        line("Host Ollama", status.hostOllamaInstalled ? "installed" : "not found"),
      ].join("\n"),
      { padding: 1, borderColor: "cyan", title: "Aegis Runtime" },
    ),
  );
}

export async function runRuntimeUse(mode: string): Promise<void> {
  const normalizedMode = mode === "native" ? "local" : mode;
  if (!["local", "remote", "docker"].includes(normalizedMode)) {
    throw new Error("Runtime mode must be one of `local`, `remote`, or `docker`.");
  }

  const runtimeService = new RuntimeService();
  const selectedMode = normalizedMode as RuntimeMode;
  runtimeService.assertSupportedMode(selectedMode);
  const config = await new ConfigService().selectRuntimeMode(selectedMode);
  console.log(`Selected runtime mode: ${config.runtime.mode}`);
}
