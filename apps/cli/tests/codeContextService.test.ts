import { describe, expect, test } from "vitest";

import { shouldInspectWorkspace } from "../src/services/codeContextService.js";

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
});
