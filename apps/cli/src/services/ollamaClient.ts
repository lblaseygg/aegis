import axios, { AxiosInstance } from "axios";

import { DEFAULT_OLLAMA_URL } from "../lib/constants.js";
import type { OllamaGenerateResponse, OllamaModelSummary } from "../types/ollama.js";

const DEFAULT_REQUEST_TIMEOUT_MS = 5_000;
const DEFAULT_GENERATE_TIMEOUT_MS = 180_000;
const DEFAULT_GENERATE_TOKENS = 128;
const DEFAULT_CONTEXT_WINDOW = 2_048;

interface OllamaTagsResponse {
  models?: Array<{ name: string; size: number; modified_at: string }>;
}

export class OllamaClient {
  private readonly http: AxiosInstance;

  constructor(baseURL = DEFAULT_OLLAMA_URL) {
    this.http = axios.create({ baseURL, timeout: DEFAULT_REQUEST_TIMEOUT_MS });
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

  async generate(model: string, prompt: string): Promise<string> {
    const response = await this.http.post<OllamaGenerateResponse>(
      "/api/generate",
      {
        model,
        prompt,
        stream: false,
        options: {
          num_predict: Number(process.env.AEGIS_OLLAMA_NUM_PREDICT ?? DEFAULT_GENERATE_TOKENS),
          num_ctx: Number(process.env.AEGIS_OLLAMA_NUM_CTX ?? DEFAULT_CONTEXT_WINDOW),
          temperature: 0.2,
        },
      },
      {
        timeout: Number(process.env.AEGIS_OLLAMA_GENERATE_TIMEOUT_MS ?? DEFAULT_GENERATE_TIMEOUT_MS),
      },
    );
    return response.data.response;
  }
}
