import { describe, expect, test } from "vitest";

import { matchSlashCommands, parseSlashCommand, SLASH_COMMANDS } from "../src/lib/chatCommands.js";

describe("parseSlashCommand", () => {
  test("returns null for normal chat input", () => {
    expect(parseSlashCommand("hello world")).toBeNull();
  });

  test("parses mode commands", () => {
    expect(parseSlashCommand("/mode docs")).toEqual({ type: "mode", mode: "docs" });
    expect(parseSlashCommand("/mode")).toEqual({ type: "mode" });
  });

  test("parses auto and manual commands", () => {
    expect(parseSlashCommand("/auto")).toEqual({ type: "auto" });
    expect(parseSlashCommand("/manual")).toEqual({ type: "manual" });
    expect(parseSlashCommand("/manual qwen3:8b")).toEqual({ type: "manual", model: "qwen3:8b" });
  });

  test("parses review toggles", () => {
    expect(parseSlashCommand("/review")).toEqual({ type: "review", enabled: true });
    expect(parseSlashCommand("/review off")).toEqual({ type: "review", enabled: false });
  });

  test("parses model and cwd arguments", () => {
    expect(parseSlashCommand("/model gemma3:12b")).toEqual({ type: "model", model: "gemma3:12b" });
    expect(parseSlashCommand("/cwd /tmp/project")).toEqual({ type: "cwd", path: "/tmp/project" });
  });

  test("matches slash commands for live suggestions", () => {
    expect(matchSlashCommands("/").map((command) => command.name)).toContain("help");
    expect(matchSlashCommands("/mo").map((command) => command.name)).toEqual(["mode", "model"]);
    expect(matchSlashCommands("/a").map((command) => command.name)).toEqual(["auto"]);
    expect(matchSlashCommands("hello")).toEqual([]);
  });

  test("shows simplified usage labels without bracket placeholders", () => {
    expect(SLASH_COMMANDS.find((command) => command.name === "model")?.usage).toBe("/model");
    expect(SLASH_COMMANDS.find((command) => command.name === "manual")?.usage).toBe("/manual");
    expect(SLASH_COMMANDS.find((command) => command.name === "review")?.usage).toBe("/review");
    expect(SLASH_COMMANDS.find((command) => command.name === "cwd")?.usage).toBe("/cwd");
  });
});
