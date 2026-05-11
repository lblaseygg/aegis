import { z } from "zod";

import type { AegisConfig } from "../types/config.js";
import { ConfigError } from "./errors.js";

const localUrlSchema = z.string().url().refine((value) => {
  const url = new URL(value);
  return ["127.0.0.1", "localhost", "ollama", "rag-api"].includes(url.hostname);
}, "URL must remain local while offline mode is enabled.");

const configSchema = z.object({
  offline_mode: z.boolean(),
  network: z.object({
    ollama_base_url: z.string().url(),
    rag_api_base_url: z.string().url(),
  }),
  runtime: z.object({
    model: z.string().min(1),
    collection: z.string().min(1),
    embedding_provider: z.string().min(1),
  }),
  rag: z.object({
    chunk_size: z.number().int().positive(),
    chunk_overlap: z.number().int().nonnegative(),
    min_chunk_chars: z.number().int().positive(),
    retrieval: z.object({
      top_k: z.number().int().positive(),
      score_threshold: z.number().min(0).max(1),
      rerank: z.boolean(),
    }),
  }),
  audit: z.object({
    log_prompts: z.boolean(),
    log_responses: z.boolean(),
    log_source_paths: z.boolean(),
    log_document_hashes: z.boolean(),
    log_errors: z.boolean(),
  }),
});

export function validateConfig(config: unknown): AegisConfig {
  const parsed = configSchema.parse(config);
  if (parsed.offline_mode) {
    localUrlSchema.parse(parsed.network.ollama_base_url);
    localUrlSchema.parse(parsed.network.rag_api_base_url);
  }

  if (parsed.rag.chunk_overlap >= parsed.rag.chunk_size) {
    throw new ConfigError("rag.chunk_overlap must be smaller than rag.chunk_size.");
  }

  return parsed;
}
