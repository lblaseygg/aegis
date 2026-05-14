export interface SlashCommandDefinition {
  name: string;
  usage: string;
  description: string;
}

export const SLASH_COMMANDS: SlashCommandDefinition[] = [
  { name: "help", usage: "/help", description: "Show the available slash commands." },
  { name: "mode", usage: "/mode docs|code", description: "Switch between docs mode and code mode." },
  { name: "auto", usage: "/auto", description: "Enable automatic model routing." },
  { name: "manual", usage: "/manual", description: "Use one fixed model for future prompts, optionally passing a model name." },
  { name: "model", usage: "/model", description: "Show the active model state or change the manual fallback model." },
  { name: "collection", usage: "/collection", description: "Show or change the active document collection." },
  { name: "review", usage: "/review", description: "Enable review mode or return to normal code chat." },
  { name: "cwd", usage: "/cwd", description: "Show or change the current workspace directory." },
  { name: "files", usage: "/files", description: "List the current workspace files." },
  { name: "resume", usage: "/resume", description: "Resume the saved session for this workspace." },
  { name: "clear", usage: "/clear", description: "Clear the current chat history." },
];

export type ParsedSlashCommand =
  | { type: "help" }
  | { type: "mode"; mode?: "docs" | "code" }
  | { type: "auto" }
  | { type: "manual"; model?: string }
  | { type: "model"; model?: string }
  | { type: "resume" }
  | { type: "review"; enabled: boolean }
  | { type: "cwd"; path?: string }
  | { type: "files" }
  | { type: "clear" }
  | { type: "collection"; collection?: string }
  | { type: "unknown"; command: string };

export function matchSlashCommands(input: string): SlashCommandDefinition[] {
  const trimmed = input.trim();
  if (!trimmed.startsWith("/")) {
    return [];
  }

  const query = trimmed.slice(1).split(/\s+/)[0]?.toLowerCase() ?? "";
  if (!query) {
    return SLASH_COMMANDS;
  }

  return SLASH_COMMANDS.filter((command) => command.name.startsWith(query));
}

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
    case "auto":
      return { type: "auto" };
    case "manual":
      return value ? { type: "manual", model: value } : { type: "manual" };
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
