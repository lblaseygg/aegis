export interface HealthStatus {
  status: string;
  chroma: string;
  ollama: string;
  offline_mode: boolean;
  collections: number;
}

export interface IngestSummary {
  collection: string;
  parsed: number;
  skipped: number;
  failed: number;
  chunks: number;
  errors: string[];
}

export interface QuerySource {
  file_name: string;
  chunk_index: number;
  score: number;
  source_path: string;
}

export interface QueryResponse {
  answer: string;
  sources: QuerySource[];
  request_id: string;
  uncertainty?: string | null;
}

export interface CollectionSummary {
  name: string;
  chunks: number;
}
