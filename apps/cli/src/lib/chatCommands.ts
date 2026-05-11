export type ParsedSlashCommand =
  | { type: "help" }
  | { type: "mode"; mode?: "docs" | "code" }
  | { type: "model"; model?: string }
  | { type: "resume" }
  | { type: "review"; enabled: boolean }
  | { type: "cwd"; path?: string }
  | { type: "files" }
  | { type: "clear" }
  | { type: "collection"; collection?: string }
  | { type: "unknown"; command: string };

export function parseSlashCommand(input: string): ParsedSlashCommand | null {
  const trimmed = input.trim();
  if (!trimmed.startsWith("/")) {
    return null;
  }

  const [rawCommand, ...rest] = trimmed.slice(1).split(/\s+/);
  const command = rawCommand.toLowerCase();
  const value = rest.join(" ").trim();

  switch (command) {
    case "help":
      return { type: "help" };
    case "mode":
      return value === "docs" || value === "code" ? { type: "mode", mode: value } : { type: "mode" };
    case "model":
      return value ? { type: "model", model: value } : { type: "model" };
    case "resume":
      return { type: "resume" };
    case "review":
      return { type: "review", enabled: value !== "off" && value !== "chat" };
    case "cwd":
      return value ? { type: "cwd", path: value } : { type: "cwd" };
    case "files":
      return { type: "files" };
    case "clear":
      return { type: "clear" };
    case "collection":
      return value ? { type: "collection", collection: value } : { type: "collection" };
    default:
      return { type: "unknown", command };
  }
}
