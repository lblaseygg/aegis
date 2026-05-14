import net from "node:net";

import { execa } from "execa";

import type { AegisConfig } from "../types/config.js";

type CommandRunner = typeof execa;

interface SshTunnelServiceOptions {
  commandRunner?: CommandRunner;
  portChecker?: (url: URL) => Promise<boolean>;
}

export class SshTunnelService {
  private readonly commandRunner: CommandRunner;
  private readonly portChecker: (url: URL) => Promise<boolean>;

  constructor(options: SshTunnelServiceOptions = {}) {
    this.commandRunner = options.commandRunner ?? execa;
    this.portChecker = options.portChecker ?? isUrlReachable;
  }

  async ensureForConfig(config: AegisConfig): Promise<void> {
    if (config.runtime.mode !== "remote") {
      return;
    }

    const tunnel = config.network.ssh_tunnel;
    if (!tunnel.enabled || tunnel.host.trim().length === 0) {
      return;
    }

    const localOllamaUrl = new URL(config.network.ollama_base_url);
    const localRagUrl = new URL(config.network.rag_api_base_url);
    const [ollamaReachable, ragReachable] = await Promise.all([
      this.portChecker(localOllamaUrl),
      this.portChecker(localRagUrl),
    ]);

    if (ollamaReachable && ragReachable) {
      return;
    }

    if (ollamaReachable !== ragReachable) {
      throw new Error(
        "Remote SSH tunnel appears partially active. Free the configured local tunnel ports or use matching forwarded ports.",
      );
    }

    const args = tunnel.use_ssh_config_forwards
      ? ["-fN", "-o", "ExitOnForwardFailure=yes", tunnel.host]
      : [
          "-fN",
          "-o",
          "ExitOnForwardFailure=yes",
          "-L",
          createForwardSpec(localOllamaUrl, new URL(tunnel.remote_ollama_url)),
          "-L",
          createForwardSpec(localRagUrl, new URL(tunnel.remote_rag_api_url)),
          tunnel.host,
        ];

    const result = await this.commandRunner("ssh", args, {
      reject: false,
      stdin: "inherit",
      stdout: "inherit",
      stderr: "inherit",
    });

    if (result.exitCode !== 0) {
      throw new Error(`Failed to start SSH tunnel for host "${tunnel.host}".`);
    }

    await waitForUrls([localOllamaUrl, localRagUrl], this.portChecker);
  }
}

function createForwardSpec(localUrl: URL, remoteUrl: URL): string {
  return `${resolvePort(localUrl)}:${remoteUrl.hostname}:${resolvePort(remoteUrl)}`;
}

function resolvePort(url: URL): number {
  if (url.port.length > 0) {
    return Number(url.port);
  }

  return url.protocol === "https:" ? 443 : 80;
}

async function waitForUrls(urls: URL[], portChecker: (url: URL) => Promise<boolean>): Promise<void> {
  const timeoutAt = Date.now() + 5_000;

  while (Date.now() < timeoutAt) {
    const checks = await Promise.all(urls.map((url) => portChecker(url)));
    if (checks.every(Boolean)) {
      return;
    }

    await new Promise((resolve) => setTimeout(resolve, 150));
  }

  throw new Error("SSH tunnel started, but the forwarded local ports did not become reachable in time.");
}

async function isUrlReachable(url: URL): Promise<boolean> {
  const port = resolvePort(url);
  return await new Promise<boolean>((resolve) => {
    const socket = net.createConnection({ host: url.hostname, port });
    const finalize = (reachable: boolean) => {
      socket.removeAllListeners();
      socket.destroy();
      resolve(reachable);
    };

    socket.setTimeout(250);
    socket.once("connect", () => finalize(true));
    socket.once("timeout", () => finalize(false));
    socket.once("error", () => finalize(false));
  });
}
