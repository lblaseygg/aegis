import { describe, expect, test } from "vitest";

import { ModelRouterService, resolveInstalledModelName } from "../src/services/modelRouterService.js";

const modelProfiles = {
  fast_general: "phi4-mini",
  long_running: "qwen3:8b",
  coding_optimized: "qwen2.5-coder:7b",
  coding_fast: "qwen2.5-coder:3b",
  coding_strong: "qwen2.5-coder:7b",
};

describe("ModelRouterService", () => {
  const router = new ModelRouterService();

  test("routes short general prompts to the fast general profile", () => {
    const resolved = router.resolve({
      prompt: "What is recursion?",
      mode: "code",
      behavior: "chat",
      manualModel: "gemma3:4b",
      selectionMode: "auto",
      modelProfiles,
      installedModels: ["phi4-mini", "qwen3:8b"],
    });

    expect(resolved.profile).toBe("fast_general");
    expect(resolved.model).toBe("phi4-mini");
  });

  test("routes review prompts to the strong coding profile", () => {
    const resolved = router.resolve({
      prompt: "Review this TypeScript change and look for regressions.",
      mode: "code",
      behavior: "review",
      manualModel: "gemma3:4b",
      selectionMode: "auto",
      modelProfiles,
      installedModels: ["qwen2.5-coder:7b", "phi4-mini"],
    });

    expect(resolved.profile).toBe("coding_strong");
    expect(resolved.model).toBe("qwen2.5-coder:7b");
  });

  test("falls back to the manual model when the preferred profile is unavailable", () => {
    const resolved = router.resolve({
      prompt: "Explain this repo architecture.",
      mode: "code",
      behavior: "chat",
      manualModel: "qwen3:8b",
      selectionMode: "auto",
      modelProfiles,
      installedModels: ["qwen3:8b"],
    });

    expect(resolved.model).toBe("qwen3:8b");
  });

  test("uses the manual model when manual selection is enabled", () => {
    const resolved = router.resolve({
      prompt: "hello",
      mode: "code",
      behavior: "chat",
      manualModel: "gemma3:4b",
      selectionMode: "manual",
      modelProfiles,
      installedModels: ["phi4-mini", "gemma3:4b"],
    });

    expect(resolved.profile).toBe("manual");
    expect(resolved.model).toBe("gemma3:4b");
  });

  test("normalizes untagged model names to :latest when available", () => {
    const resolved = router.resolve({
      prompt: "hello",
      mode: "code",
      behavior: "chat",
      manualModel: "qwen3:8b",
      selectionMode: "auto",
      modelProfiles,
      installedModels: ["phi4-mini:latest", "qwen3:8b"],
    });

    expect(resolved.profile).toBe("fast_general");
    expect(resolved.model).toBe("phi4-mini:latest");
  });

  test("resolves explicit latest-tag aliases", () => {
    expect(resolveInstalledModelName("phi4-mini", ["phi4-mini:latest"])).toBe("phi4-mini:latest");
    expect(resolveInstalledModelName("phi4-mini:latest", ["phi4-mini"])).toBe("phi4-mini");
  });
});
