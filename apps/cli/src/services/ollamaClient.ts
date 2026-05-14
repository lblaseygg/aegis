import readline from "node:readline";
import type { Readable } from "node:stream";

import axios, { AxiosError, AxiosInstance } from "axios";

import { DEFAULT_OLLAMA_URL } from "../lib/constants.js";
import type { ChatProgressUpdate } from "../types/chat.js";
import type { OllamaGenerateStreamResponse, OllamaModelSummary } from "../types/ollama.js";

const DEFAULT_REQUEST_TIMEOUT_MS = 5_000;
const DEFAULT_GENERATE_TIMEOUT_MS = 180_000;
const DEFAULT_GENERATE_TOKENS = 512;
const DEFAULT_CONTEXT_WINDOW = 2_048;

interface OllamaTagsResponse {
  models?: Array<{ name: string; size: number; modified_at: string }>;
}

export class OllamaClient {
  private readonly http: AxiosInstance;
  private readonly baseURL: string;

  constructor(baseURL = DEFAULT_OLLAMA_URL) {
    this.baseURL = baseURL;
    this.http = axios.create({ baseURL, timeout: DEFAULT_REQUEST_TIMEOUT_MS });
  }

  async listModels(): Promise<OllamaModelSummary[]> {
    try {
      const response = await this.http.get<OllamaTagsResponse>("/api/tags");
      return (response.data.models ?? []).map((model) => ({
        name: model.name,
        size: model.size,
        modified_at: model.modified_at,
      }));
    } catch (error) {
      throw new Error(formatOllamaError(error, this.baseURL));
    }
  }

  async health(): Promise<"online" | "offline"> {
    try {
      await this.http.get("/api/tags");
      return "online";
    } catch {
      return "offline";
    }
  }

  async generate(
    model: string,
    prompt: string,
    onProgress?: (update: ChatProgressUpdate) => void,
  ): Promise<string> {
    try {
      const response = await this.http.post<Readable>(
        "/api/generate",
        {
          model,
          prompt,
          stream: true,
          options: {
            num_predict: Number(process.env.AEGIS_OLLAMA_NUM_PREDICT ?? DEFAULT_GENERATE_TOKENS),
            num_ctx: Number(process.env.AEGIS_OLLAMA_NUM_CTX ?? DEFAULT_CONTEXT_WINDOW),
            temperature: 0.2,
          },
        },
        {
          responseType: "stream",
          timeout: Number(process.env.AEGIS_OLLAMA_GENERATE_TIMEOUT_MS ?? DEFAULT_GENERATE_TIMEOUT_MS),
        },
      );

      let rawResponse = "";
      const lines = readline.createInterface({ input: response.data, crlfDelay: Infinity });

      for await (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) {
          continue;
        }

        const chunk = JSON.parse(trimmed) as OllamaGenerateStreamResponse;
        rawResponse += chunk.response ?? "";
        const parsed = parseThinkingEnvelope(rawResponse);
        onProgress?.({
          model,
          phase: parsed.thinking ? "thinking" : "working",
          thinking: parsed.thinking || undefined,
        });
      }

      const parsed = parseThinkingEnvelope(rawResponse);
      return parsed.answer || stripThinkingTags(rawResponse);
    } catch (error) {
      throw new Error(formatOllamaError(error, this.baseURL, model));
    }
  }
}

export function parseThinkingEnvelope(raw: string): { thinking: string; answer: string } {
  let cursor = 0;
  let thinking = "";
  let answer = "";
  let inThinking = false;

  while (cursor < raw.length) {
    if (!inThinking) {
      const start = raw.indexOf("<think>", cursor);
      if (start === -1) {
        answer += raw.slice(cursor);
        break;
      }

      answer += raw.slice(cursor, start);
      cursor = start + "<think>".length;
      inThinking = true;
      continue;
    }

    const end = raw.indexOf("</think>", cursor);
    if (end === -1) {
      thinking += raw.slice(cursor);
      cursor = raw.length;
      break;
    }

    thinking += raw.slice(cursor, end);
    cursor = end + "</think>".length;
    inThinking = false;
  }

  const hadThinking = raw.includes("<think>");
  return {
    thinking: thinking.trim(),
    answer: hadThinking ? answer.replace(/^\s+/, "").trim() : answer.trim(),
  };
}

export function stripThinkingTags(raw: string): string {
  return raw.replace(/<\/?think>/g, "").trim();
}

function formatOllamaError(error: unknown, baseURL: string, model?: string): string {
  if (axios.isAxiosError(error)) {
    const axiosError = error as AxiosError<{ error?: string }>;
    if (axiosError.response?.status === 404 && model) {
      return `Model "${model}" is not available on the configured Ollama server at ${baseURL}. Select an installed model with \`/model\` or \`aegis models select\`.`;
    }

    if (axiosError.code === "ECONNREFUSED") {
      return `Ollama is unreachable at ${baseURL}. If you are using remote mode, verify the SSH tunnel or forwarded local port.`;
    }

    const remoteMessage = axiosError.response?.data?.error;
    if (remoteMessage) {
      return `Ollama request failed at ${baseURL}: ${remoteMessage}`;
    }
  }

  if (error instanceof Error) {
    return error.message;
  }

  return `Ollama request failed at ${baseURL}.`;
}
