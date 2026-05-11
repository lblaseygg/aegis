import axios, { AxiosInstance } from "axios";

import { DEFAULT_OLLAMA_URL } from "../lib/constants.js";
import type { OllamaModelSummary } from "../types/ollama.js";

interface OllamaTagsResponse {
  models?: Array<{ name: string; size: number; modified_at: string }>;
}

export class OllamaClient {
  private readonly http: AxiosInstance;

  constructor(baseURL = DEFAULT_OLLAMA_URL) {
    this.http = axios.create({ baseURL, timeout: 5000 });
  }

  async listModels(): Promise<OllamaModelSummary[]> {
    const response = await this.http.get<OllamaTagsResponse>("/api/tags");
    return (response.data.models ?? []).map((model) => ({
      name: model.name,
      size: model.size,
      modified_at: model.modified_at,
    }));
  }

  async health(): Promise<"online" | "offline"> {
    try {
      await this.http.get("/api/tags");
      return "online";
    } catch {
      return "offline";
    }
  }
}
