export type RuntimeMode = "local" | "remote" | "docker";
export type ModelSelectionMode = "auto" | "manual";
export type ModelProfileName = "fast_general" | "long_running" | "coding_optimized" | "coding_fast" | "coding_strong";

export interface ModelProfiles {
  fast_general: string;
  long_running: string;
  coding_optimized: string;
  coding_fast: string;
  coding_strong: string;
}

export interface AegisConfig {
  offline_mode: boolean;
  network: {
    ollama_base_url: string;
    rag_api_base_url: string;
  };
  runtime: {
    mode: RuntimeMode;
    model: string;
    selection: ModelSelectionMode;
    model_profiles: ModelProfiles;
    collection: string;
    embedding_provider: string;
  };
  rag: {
    chunk_size: number;
    chunk_overlap: number;
    min_chunk_chars: number;
    retrieval: {
      top_k: number;
      score_threshold: number;
      rerank: boolean;
    };
  };
  audit: {
    log_prompts: boolean;
    log_responses: boolean;
    log_source_paths: boolean;
    log_document_hashes: boolean;
    log_errors: boolean;
  };
}
