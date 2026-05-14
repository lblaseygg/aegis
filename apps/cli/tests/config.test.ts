import { describe, expect, test } from "vitest";

import { validateConfig } from "../src/lib/validators.js";

const modelProfiles = {
  fast_general: "phi4-mini",
  long_running: "qwen3:8b",
  coding_optimized: "qwen2.5-coder:7b",
  coding_fast: "qwen2.5-coder:3b",
  coding_strong: "qwen2.5-coder:7b",
};

describe("validateConfig", () => {
  test("accepts local offline endpoints", () => {
    const config = validateConfig({
      offline_mode: true,
      network: {
        ollama_base_url: "http://127.0.0.1:11434",
        rag_api_base_url: "http://127.0.0.1:8088",
      },
      runtime: {
        mode: "docker",
        model: "gemma3:4b",
        selection: "manual",
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
    });

    expect(config.runtime.model).toBe("gemma3:4b");
    expect(config.network.ssh_tunnel.enabled).toBe(false);
  });

  test("rejects non-local offline endpoints", () => {
    expect(() =>
      validateConfig({
        offline_mode: true,
        network: {
          ollama_base_url: "https://example.com",
          rag_api_base_url: "http://127.0.0.1:8088",
        },
      runtime: {
        mode: "docker",
        model: "gemma3:4b",
        selection: "manual",
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
      }),
    ).toThrow();
  });

  test("accepts host.docker.internal for offline local containers", () => {
    const config = validateConfig({
      offline_mode: true,
      network: {
        ollama_base_url: "http://host.docker.internal:11434",
        rag_api_base_url: "http://127.0.0.1:8088",
      },
      runtime: {
        mode: "local",
        model: "gemma3:4b",
        selection: "manual",
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
    });

    expect(config.network.ollama_base_url).toContain("host.docker.internal");
  });

  test("accepts private LAN endpoints in offline mode", () => {
    const config = validateConfig({
      offline_mode: true,
      network: {
        ollama_base_url: "http://192.168.0.12:11434",
        rag_api_base_url: "http://192.168.0.12:8088",
      },
      runtime: {
        mode: "remote",
        model: "qwen3:8b",
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
    });

    expect(config.network.ollama_base_url).toContain("192.168.0.12");
  });
});
