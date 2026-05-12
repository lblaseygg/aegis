import { describe, expect, test } from "vitest";

import { RuntimeService } from "../src/services/runtimeService.js";

describe("RuntimeService", () => {
  test("prefers native mode on macOS when native Ollama is installed", async () => {
    const service = new RuntimeService({
      platform: "darwin",
      nativeInstallDetector: async () => true,
    });

    await expect(service.recommendedMode()).resolves.toBe("native");
  });

  test("falls back to docker mode when native Ollama is unavailable", async () => {
    const service = new RuntimeService({
      platform: "darwin",
      nativeInstallDetector: async () => false,
    });

    await expect(service.recommendedMode()).resolves.toBe("docker");
  });

  test("routes docker compose to host Ollama for native mode on macOS", () => {
    const service = new RuntimeService({
      platform: "darwin",
      nativeInstallDetector: async () => true,
    });

    expect(
      service.getComposeEnvironment({
        offline_mode: true,
        network: {
          ollama_base_url: "http://127.0.0.1:11434",
          rag_api_base_url: "http://127.0.0.1:8088",
        },
        runtime: {
          mode: "native",
          model: "gemma3:4b",
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
