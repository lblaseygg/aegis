import { describe, expect, test } from "vitest";

import { parseThinkingEnvelope } from "../src/services/ollamaClient.js";

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
});
