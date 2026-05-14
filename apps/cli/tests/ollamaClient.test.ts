import { Readable } from "node:stream";

import { beforeEach, describe, expect, test, vi } from "vitest";

vi.mock("axios", () => ({
  default: {
    create: vi.fn(),
  },
}));

import { OllamaClient, parseThinkingEnvelope, sanitizeModelAnswer, stripThinkingTags } from "../src/services/ollamaClient.js";
import axios from "axios";

const createMock = vi.mocked(axios.create);

beforeEach(() => {
  createMock.mockReset();
});

describe("parseThinkingEnvelope", () => {
  test("strips think tags and returns a clean answer", () => {
    const parsed = parseThinkingEnvelope("<think>plan the reply</think>\n\nHello there.");

    expect(parsed.thinking).toBe("plan the reply");
    expect(parsed.answer).toBe("Hello there.");
  });

  test("keeps plain responses unchanged", () => {
    const parsed = parseThinkingEnvelope("Hello there.");

    expect(parsed.thinking).toBe("");
    expect(parsed.answer).toBe("Hello there.");
  });

  test("falls back cleanly when think tags are unclosed", () => {
    const parsed = parseThinkingEnvelope("<think>plan the reply\nHello there.");

    expect(parsed.answer).toBe("");
    expect(stripThinkingTags("<think>plan the reply\nHello there.")).toBe("plan the reply\nHello there.");
  });

  test("removes generic working-directory follow-up boilerplate", () => {
    expect(
      sanitizeModelAnswer(
        "Here is the answer.\n\nIf you'd like to know more details regarding your working directory (working directory), feel free to ask!.",
      ),
    ).toBe("Here is the answer.");
  });

  test("uses a larger default token budget for generation", async () => {
    const post = vi.fn().mockResolvedValue({
      data: Readable.from(['{"response":"Hello there.","done":true}\n']),
    });
    createMock.mockReturnValue({
      post,
      get: vi.fn(),
    });

    const client = new OllamaClient("http://127.0.0.1:11434");
    const answer = await client.generate("qwen3:8b", "hello");

    expect(answer).toBe("Hello there.");
    expect(post).toHaveBeenCalledWith(
      "/api/generate",
      expect.objectContaining({
        options: expect.objectContaining({
          num_predict: 512,
        }),
      }),
      expect.any(Object),
    );
  });
});
