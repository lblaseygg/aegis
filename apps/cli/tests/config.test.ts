import { describe, expect, test } from "vitest";

import { validateConfig } from "../src/lib/validators.js";

describe("validateConfig", () => {
  test("accepts local offline endpoints", () => {
    const config = validateConfig({
      offline_mode: true,
      network: {
        ollama_base_url: "http://127.0.0.1:11434",
        rag_api_base_url: "http://127.0.0.1:8088",
      },
      runtime: {
        model: "llama3.2:3b",
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

    expect(config.runtime.model).toBe("llama3.2:3b");
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
          model: "llama3.2:3b",
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
});
