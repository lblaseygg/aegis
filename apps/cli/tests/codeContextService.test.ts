import { describe, expect, test, vi } from "vitest";

import { CodeContextService, resolveMentionedFiles, shouldInspectWorkspace } from "../src/services/codeContextService.js";

describe("shouldInspectWorkspace", () => {
  test("does not inspect the workspace for ordinary chat prompts", () => {
    expect(shouldInspectWorkspace("Say hello in one sentence.", "chat")).toBe(false);
  });

  test("inspects the workspace for explicit repo or file requests", () => {
    expect(shouldInspectWorkspace("Scan the current folder and explain the repo.", "chat")).toBe(true);
    expect(shouldInspectWorkspace("Improve documentation in @README.md", "chat")).toBe(true);
  });

  test("always inspects the workspace in review mode", () => {
    expect(shouldInspectWorkspace("anything", "review")).toBe(true);
  });

  test("resolves @mentions against the current workspace files", () => {
    const files = ["README.md", "src/index.ts", "worker/worker/cli.py"];

    expect(resolveMentionedFiles("Explain @README.md and @cli.py", files)).toEqual([
      "README.md",
      "worker/worker/cli.py",
    ]);
  });

  test("buildPrompt resolves @mentions from a broader workspace list than the top-level context slice", async () => {
    const service = new CodeContextService();
    const listFiles = vi
      .spyOn(service, "listFiles")
      .mockResolvedValueOnce(["src/a.ts", "src/b.ts"])
      .mockResolvedValueOnce(["src/a.ts", "src/b.ts", "README.md"]);
    const readSnippet = vi
      .spyOn(service as never, "readSnippet")
      .mockResolvedValue("File: README.md\n1: # Project");

    const prompt = await service.buildPrompt({
      cwd: "/workspace",
      question: "Explain @README.md",
      model: "qwen3:8b",
      behavior: "chat",
      history: [],
    });

    expect(prompt).toContain("File: README.md");
    expect(listFiles).toHaveBeenCalledTimes(2);
    expect(readSnippet).toHaveBeenCalled();
  });
});
