import { describe, expect, test } from "vitest";

import { RuntimeService } from "../src/services/runtimeService.js";

const modelProfiles = {
  fast_general: "phi4-mini",
  long_running: "qwen3:8b",
  coding_optimized: "qwen2.5-coder:7b",
  coding_fast: "qwen2.5-coder:3b",
  coding_strong: "qwen2.5-coder:7b",
};

describe("RuntimeService", () => {
  test("prefers local mode on macOS when host Ollama is installed", async () => {
    const service = new RuntimeService({
      platform: "darwin",
      hostInstallDetector: async () => true,
    });

    await expect(service.recommendedMode()).resolves.toBe("local");
  });

  test("falls back to docker mode when host Ollama is unavailable", async () => {
    const service = new RuntimeService({
      platform: "darwin",
      hostInstallDetector: async () => false,
    });

    await expect(service.recommendedMode()).resolves.toBe("docker");
  });

  test("routes docker compose to host Ollama for local mode on macOS", () => {
    const service = new RuntimeService({
      platform: "darwin",
      hostInstallDetector: async () => true,
    });

    expect(
      service.getComposeEnvironment({
        offline_mode: true,
        network: {
          ollama_base_url: "http://127.0.0.1:11434",
          rag_api_base_url: "http://127.0.0.1:8088",
          ssh_tunnel: {
            enabled: false,
            host: "",
            use_ssh_config_forwards: false,
            remote_ollama_url: "http://127.0.0.1:11434",
            remote_rag_api_url: "http://127.0.0.1:8088",
          },
        },
        runtime: {
          mode: "local",
          model: "gemma3:4b",
          selection: "auto",
          model_profiles: modelProfiles,
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
      }).OLLAMA_BASE_URL,
    ).toBe("http://host.docker.internal:11434");
  });
});
