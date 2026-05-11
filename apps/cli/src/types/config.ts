export interface AegisConfig {
  offline_mode: boolean;
  network: {
    ollama_base_url: string;
    rag_api_base_url: string;
  };
  runtime: {
    mode: "native" | "docker";
    model: string;
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
