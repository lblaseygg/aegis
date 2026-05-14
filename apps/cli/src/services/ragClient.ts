import axios, { AxiosError, AxiosInstance } from "axios";

import { DEFAULT_RAG_API_URL } from "../lib/constants.js";
import type { AuditEvent } from "../types/audit.js";
import type { CollectionSummary, HealthStatus, IngestSummary, QueryResponse } from "../types/rag.js";

const DEFAULT_REQUEST_TIMEOUT_MS = 30_000;
const DEFAULT_QUERY_TIMEOUT_MS = 180_000;

export class RagClient {
  private readonly http: AxiosInstance;
  private readonly baseURL: string;

  constructor(baseURL = DEFAULT_RAG_API_URL) {
    this.baseURL = baseURL;
    this.http = axios.create({ baseURL, timeout: DEFAULT_REQUEST_TIMEOUT_MS });
  }

  async health(): Promise<HealthStatus> {
    try {
      const response = await this.http.get<HealthStatus>("/health");
      return response.data;
    } catch (error) {
      throw new Error(formatRagError(error, this.baseURL));
    }
  }

  async collections(): Promise<CollectionSummary[]> {
    const response = await this.http.get<CollectionSummary[]>("/collections");
    return response.data;
  }

  async ingest(path: string, collection: string, recursive = true): Promise<IngestSummary> {
    try {
      const response = await this.http.post<IngestSummary>("/ingest", { path, collection, recursive });
      return response.data;
    } catch (error) {
      throw new Error(formatRagError(error, this.baseURL));
    }
  }

  async query(question: string, collection: string, model: string, topK: number): Promise<QueryResponse> {
    try {
      const response = await this.http.post<QueryResponse>("/query", {
        question,
        collection,
        model,
        top_k: topK,
      }, {
        timeout: Number(process.env.AEGIS_QUERY_TIMEOUT_MS ?? DEFAULT_QUERY_TIMEOUT_MS),
      });
      return response.data;
    } catch (error) {
      throw new Error(formatRagError(error, this.baseURL, model));
    }
  }

  async recentAudit(limit = 50): Promise<AuditEvent[]> {
    const response = await this.http.get<AuditEvent[]>("/audit/recent", { params: { limit } });
    return response.data;
  }
}

function formatRagError(error: unknown, baseURL: string, model?: string): string {
  if (axios.isAxiosError(error)) {
    const axiosError = error as AxiosError<{ detail?: string; error?: string }>;
    if (axiosError.code === "ECONNREFUSED") {
      return `RAG API is unreachable at ${baseURL}. Verify the service is running and that your configured forwarded local port matches the tunnel.`;
    }

    const detail = axiosError.response?.data?.detail ?? axiosError.response?.data?.error;
    if (axiosError.response?.status === 404 && model) {
      return `The RAG API could not complete the query with model "${model}" at ${baseURL}. Verify the selected model exists on the connected Ollama server.`;
    }

    if (detail) {
      return `RAG API request failed at ${baseURL}: ${detail}`;
    }
  }

  if (error instanceof Error) {
    return error.message;
  }

  return `RAG API request failed at ${baseURL}.`;
}
