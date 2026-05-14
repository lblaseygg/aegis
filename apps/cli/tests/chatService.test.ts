import { describe, expect, test, vi } from "vitest";

import { ChatService } from "../src/services/chatService.js";
import type { ChatSessionState } from "../src/types/chat.js";

const modelProfiles = {
  fast_general: "phi4-mini",
  long_running: "qwen3:8b",
  coding_optimized: "qwen2.5-coder:7b",
  coding_fast: "qwen2.5-coder:3b",
  coding_strong: "qwen2.5-coder:7b",
};

describe("ChatService", () => {
  test("clears the last resolved model when switching to auto", async () => {
    const service = createService();

    const result = await service.handleInput("/auto", createSession());

    expect(result.session.selectionMode).toBe("auto");
    expect(result.session.lastResolvedModel).toBeUndefined();
  });

  test("shows unresolved auto state instead of the manual fallback as last used", async () => {
    const service = createService();
    const autoSession = (await service.handleInput("/auto", createSession())).session;

    const result = await service.handleInput("/model", autoSession);
    const statusMessage = result.session.history.at(-1)?.text ?? "";

    expect(statusMessage).toContain("Selection mode: auto");
    expect(statusMessage).toContain("Manual model: qwen3:8b");
    expect(statusMessage).toContain("Last used: not resolved yet");
  });
});

function createService(): ChatService {
  const configService = {
    selectModel: vi.fn(async () => ({})),
    selectModelSelectionMode: vi.fn(async () => ({})),
  };

  const sessionStore = {
    save: vi.fn(async () => undefined),
    resume: vi.fn(),
    clear: vi.fn(),
    load: vi.fn(),
  };

  const ragClient = {
    query: vi.fn(),
  };

  const ollamaClient = {
    listModels: vi.fn(async () => [
      { name: "phi4-mini", size: 1, modified_at: "2026-01-01T00:00:00Z" },
      { name: "qwen3:8b", size: 1, modified_at: "2026-01-01T00:00:00Z" },
    ]),
    generate: vi.fn(),
  };

  const codeContextService = {
    buildPrompt: vi.fn(),
    listFiles: vi.fn(),
  };

  return new ChatService(
    configService as never,
    sessionStore as never,
    ragClient as never,
    ollamaClient as never,
    codeContextService as never,
  );
}

function createSession(): ChatSessionState {
  return {
    mode: "code",
    behavior: "chat",
    model: "qwen3:8b",
    selectionMode: "manual",
    modelProfiles,
    lastResolvedModel: "qwen3:8b",
    collection: "default",
    cwd: "/tmp/project",
    history: [],
  };
}
