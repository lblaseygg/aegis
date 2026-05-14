import { describe, expect, test, vi } from "vitest";

import type { AegisConfig } from "../src/types/config.js";
import { SshTunnelService } from "../src/services/sshTunnelService.js";

const baseConfig: AegisConfig = {
  offline_mode: true,
  network: {
    ollama_base_url: "http://127.0.0.1:11435",
    rag_api_base_url: "http://127.0.0.1:18088",
    ssh_tunnel: {
      enabled: true,
      host: "aegis-ubuntu",
      use_ssh_config_forwards: false,
      remote_ollama_url: "http://127.0.0.1:11434",
      remote_rag_api_url: "http://127.0.0.1:8088",
    },
  },
  runtime: {
    mode: "remote",
    model: "qwen3:8b",
    selection: "auto",
    model_profiles: {
      fast_general: "phi4-mini",
      long_running: "qwen3:8b",
      coding_optimized: "qwen2.5-coder:7b",
      coding_fast: "qwen2.5-coder:3b",
      coding_strong: "qwen2.5-coder:7b",
    },
    collection: "default",
    embedding_provider: "hash",
  },
  rag: {
    chunk_size: 900,
    chunk_overlap: 150,
    min_chunk_chars: 200,
    retrieval: {
      top_k: 6,
      score_threshold: 0.45,
      rerank: false,
    },
  },
  audit: {
    log_prompts: false,
    log_responses: false,
    log_source_paths: true,
    log_document_hashes: true,
    log_errors: true,
  },
};

describe("SshTunnelService", () => {
  test("starts ssh when remote tunnel is enabled and ports are unavailable", async () => {
    const commandRunner = vi.fn().mockResolvedValue({ exitCode: 0 });
    const portChecker = vi
      .fn()
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(true);

    await new SshTunnelService({
      commandRunner: commandRunner as never,
      portChecker,
    }).ensureForConfig(baseConfig);

    expect(commandRunner).toHaveBeenCalledWith(
      "ssh",
      [
        "-fN",
        "-o",
        "ExitOnForwardFailure=yes",
        "-L",
        "11435:127.0.0.1:11434",
        "-L",
        "18088:127.0.0.1:8088",
        "aegis-ubuntu",
      ],
      expect.objectContaining({
        reject: false,
      }),
    );
  });

  test("uses ssh config forwards when configured", async () => {
    const commandRunner = vi.fn().mockResolvedValue({ exitCode: 0 });
    const portChecker = vi
      .fn()
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(true);

    await new SshTunnelService({
      commandRunner: commandRunner as never,
      portChecker,
    }).ensureForConfig({
      ...baseConfig,
      network: {
        ...baseConfig.network,
        ssh_tunnel: {
          ...baseConfig.network.ssh_tunnel,
          use_ssh_config_forwards: true,
        },
      },
    });

    expect(commandRunner).toHaveBeenCalledWith(
      "ssh",
      ["-fN", "-o", "ExitOnForwardFailure=yes", "aegis-ubuntu"],
      expect.objectContaining({
        reject: false,
      }),
    );
  });

  test("does nothing when the local tunnel ports are already reachable", async () => {
    const commandRunner = vi.fn();
    const portChecker = vi.fn().mockResolvedValue(true);

    await new SshTunnelService({
      commandRunner: commandRunner as never,
      portChecker,
    }).ensureForConfig(baseConfig);

    expect(commandRunner).not.toHaveBeenCalled();
  });
});
