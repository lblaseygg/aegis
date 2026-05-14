import { z } from "zod";

import type { AegisConfig } from "../types/config.js";
import { ConfigError } from "./errors.js";

const localUrlSchema = z.string().url().refine((value) => {
  const url = new URL(value);
  return isPermittedOfflineHost(url.hostname);
}, "URL must remain local while offline mode is enabled.");

const configSchema = z.object({
  offline_mode: z.boolean(),
  network: z.object({
    ollama_base_url: z.string().url(),
    rag_api_base_url: z.string().url(),
  }),
  runtime: z.object({
    mode: z.enum(["local", "remote", "docker"]),
    model: z.string().min(1),
    selection: z.enum(["auto", "manual"]),
    model_profiles: z.object({
      fast_general: z.string().min(1),
      long_running: z.string().min(1),
      coding_optimized: z.string().min(1),
      coding_fast: z.string().min(1),
      coding_strong: z.string().min(1),
    }),
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

function isPermittedOfflineHost(hostname: string): boolean {
  if (["127.0.0.1", "localhost", "ollama", "rag-api", "host.docker.internal"].includes(hostname)) {
    return true;
  }

  if (hostname.endsWith(".local")) {
    return true;
  }

  const ipv4Match = hostname.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!ipv4Match) {
    return false;
  }

  const octets = ipv4Match.slice(1).map((part) => Number(part));
  if (octets.some((octet) => Number.isNaN(octet) || octet < 0 || octet > 255)) {
    return false;
  }

  const [first, second] = octets;
  return first === 10 || first === 127 || (first === 192 && second === 168) || (first === 172 && second >= 16 && second <= 31);
}
