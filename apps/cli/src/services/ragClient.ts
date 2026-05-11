import axios, { AxiosInstance } from "axios";

import { DEFAULT_RAG_API_URL } from "../lib/constants.js";
import type { AuditEvent } from "../types/audit.js";
import type { CollectionSummary, HealthStatus, IngestSummary, QueryResponse } from "../types/rag.js";

export class RagClient {
  private readonly http: AxiosInstance;

  constructor(baseURL = DEFAULT_RAG_API_URL) {
    this.http = axios.create({ baseURL, timeout: 30_000 });
  }

  async health(): Promise<HealthStatus> {
    const response = await this.http.get<HealthStatus>("/health");
    return response.data;
  }

  async collections(): Promise<CollectionSummary[]> {
    const response = await this.http.get<CollectionSummary[]>("/collections");
    return response.data;
  }

  async ingest(path: string, collection: string, recursive = true): Promise<IngestSummary> {
    const response = await this.http.post<IngestSummary>("/ingest", { path, collection, recursive });
    return response.data;
  }

  async query(question: string, collection: string, model: string, topK: number): Promise<QueryResponse> {
    const response = await this.http.post<QueryResponse>("/query", {
      question,
      collection,
      model,
      top_k: topK,
    });
    return response.data;
  }

  async recentAudit(limit = 50): Promise<AuditEvent[]> {
    const response = await this.http.get<AuditEvent[]>("/audit/recent", { params: { limit } });
    return response.data;
  }
}
