import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

import chalk from "chalk";

import { ConfigService } from "../services/configService.js";
import { OllamaClient } from "../services/ollamaClient.js";
import { RagClient } from "../services/ragClient.js";
import { SshTunnelService, isLocalPortFree } from "../services/sshTunnelService.js";

interface RemoteConnectOptions {
  host?: string;
  ollamaPort?: string;
  ragPort?: string;
  remoteOllamaUrl?: string;
  remoteRagUrl?: string;
  model?: string;
  useSshConfigForwards?: boolean;
}

export async function runRemoteConnect(options: RemoteConnectOptions): Promise<void> {
  const existing = await new ConfigService().load({ includeEnvOverrides: false });
  const answers = await collectRemoteAnswers(existing, options);
  const tunnelService = new SshTunnelService();

  await tunnelService.validateHost(answers.host);

  const [ollamaPortFree, ragPortFree] = await Promise.all([
    isLocalPortFree(answers.ollamaPort),
    isLocalPortFree(answers.ragPort),
  ]);

  if (!ollamaPortFree) {
    throw new Error(
      `Local port ${answers.ollamaPort} is already in use. Choose a different forwarded Ollama port or stop the conflicting process.`,
    );
  }

  if (!ragPortFree) {
    throw new Error(
      `Local port ${answers.ragPort} is already in use. Choose a different forwarded RAG port or stop the conflicting process.`,
    );
  }

  const nextConfig = structuredClone(existing);
  nextConfig.runtime.mode = "remote";
  nextConfig.network.ollama_base_url = `http://127.0.0.1:${answers.ollamaPort}`;
  nextConfig.network.rag_api_base_url = `http://127.0.0.1:${answers.ragPort}`;
  nextConfig.network.ssh_tunnel = {
    enabled: true,
    host: answers.host,
    use_ssh_config_forwards: answers.useSshConfigForwards,
    remote_ollama_url: answers.remoteOllamaUrl,
    remote_rag_api_url: answers.remoteRagUrl,
  };
  if (answers.model) {
    nextConfig.runtime.model = answers.model;
  }

  await tunnelService.ensureForConfig(nextConfig);

  const ollama = new OllamaClient(nextConfig.network.ollama_base_url);
  const rag = new RagClient(nextConfig.network.rag_api_base_url);
  const [models, ragStatus] = await Promise.all([ollama.listModels(), rag.health()]);

  if (models.length === 0) {
    throw new Error(
      `Connected to Ollama through the SSH tunnel, but no models are installed. Pull a model on the server before using Aegis.`,
    );
  }

  if (!models.some((model) => model.name === nextConfig.runtime.model)) {
    nextConfig.runtime.model = models[0]?.name ?? nextConfig.runtime.model;
  }

  await new ConfigService().save(nextConfig);

  console.log(chalk.cyan("Remote connection saved."));
  console.log(`SSH host: ${answers.host}`);
  console.log(`Ollama:   ${nextConfig.network.ollama_base_url}`);
  console.log(`RAG API:  ${nextConfig.network.rag_api_base_url}`);
  console.log(`Model:    ${nextConfig.runtime.model}`);
  console.log(`RAG:      ${ragStatus.status} (${ragStatus.chroma})`);
}

interface RemoteAnswers {
  host: string;
  ollamaPort: number;
  ragPort: number;
  remoteOllamaUrl: string;
  remoteRagUrl: string;
  useSshConfigForwards: boolean;
  model?: string;
}

async function collectRemoteAnswers(existing: Awaited<ReturnType<ConfigService["load"]>>, options: RemoteConnectOptions): Promise<RemoteAnswers> {
  const rl = readline.createInterface({ input, output });
  try {
    const defaultHost = existing.network.ssh_tunnel.host || "user@server";
    const defaultOllamaPort = new URL(existing.network.ollama_base_url).port || "11435";
    const defaultRagPort = new URL(existing.network.rag_api_base_url).port || "18088";
    const defaultRemoteOllamaUrl = existing.network.ssh_tunnel.remote_ollama_url || "http://127.0.0.1:11434";
    const defaultRemoteRagUrl = existing.network.ssh_tunnel.remote_rag_api_url || "http://127.0.0.1:8088";
    const defaultUseConfigForwards = existing.network.ssh_tunnel.use_ssh_config_forwards;

    const host = await promptValue(rl, "SSH host or alias", options.host, defaultHost);
    const ollamaPort = parseRequiredPort(
      await promptValue(rl, "Local forwarded Ollama port", options.ollamaPort, defaultOllamaPort),
      "Ollama port",
    );
    const ragPort = parseRequiredPort(
      await promptValue(rl, "Local forwarded RAG port", options.ragPort, defaultRagPort),
      "RAG port",
    );
    const useSshConfigForwards = await promptBoolean(
      rl,
      "Reuse LocalForward entries from SSH config",
      options.useSshConfigForwards,
      defaultUseConfigForwards,
    );
    const remoteOllamaUrl = await promptValue(rl, "Remote Ollama URL", options.remoteOllamaUrl, defaultRemoteOllamaUrl);
    const remoteRagUrl = await promptValue(rl, "Remote RAG API URL", options.remoteRagUrl, defaultRemoteRagUrl);
    const model = await promptValue(rl, "Preferred model (optional)", options.model, existing.runtime.model);

    return {
      host,
      ollamaPort,
      ragPort,
      remoteOllamaUrl,
      remoteRagUrl,
      useSshConfigForwards,
      model: model.trim() || undefined,
    };
  } finally {
    rl.close();
  }
}

async function promptValue(
  rl: readline.Interface,
  label: string,
  explicit: string | undefined,
  defaultValue: string,
): Promise<string> {
  if (explicit !== undefined) {
    return explicit.trim() || defaultValue;
  }

  const response = await rl.question(`${label} [${defaultValue}]: `);
  return response.trim() || defaultValue;
}

async function promptBoolean(
  rl: readline.Interface,
  label: string,
  explicit: boolean | undefined,
  defaultValue: boolean,
): Promise<boolean> {
  if (explicit !== undefined) {
    return explicit;
  }

  const renderedDefault = defaultValue ? "Y/n" : "y/N";
  const response = (await rl.question(`${label} [${renderedDefault}]: `)).trim().toLowerCase();
  if (!response) {
    return defaultValue;
  }

  return response === "y" || response === "yes";
}

function parseRequiredPort(value: string, label: string): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0 || parsed > 65535) {
    throw new Error(`${label} must be a valid TCP port between 1 and 65535.`);
  }

  return parsed;
}
