import { describe, expect, test } from "vitest";

import { parseSlashCommand } from "../src/lib/chatCommands.js";

describe("parseSlashCommand", () => {
  test("returns null for normal chat input", () => {
    expect(parseSlashCommand("hello world")).toBeNull();
  });

  test("parses mode commands", () => {
    expect(parseSlashCommand("/mode docs")).toEqual({ type: "mode", mode: "docs" });
    expect(parseSlashCommand("/mode")).toEqual({ type: "mode" });
  });

  test("parses review toggles", () => {
    expect(parseSlashCommand("/review")).toEqual({ type: "review", enabled: true });
    expect(parseSlashCommand("/review off")).toEqual({ type: "review", enabled: false });
  });

  test("parses model and cwd arguments", () => {
    expect(parseSlashCommand("/model gemma:7b")).toEqual({ type: "model", model: "gemma:7b" });
    expect(parseSlashCommand("/cwd /tmp/project")).toEqual({ type: "cwd", path: "/tmp/project" });
  });
});
