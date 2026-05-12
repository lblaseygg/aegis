import path from "node:path";

import { SLASH_COMMANDS } from "../lib/chatCommands.js";
import type { AegisConfig } from "../types/config.js";
import type { ChatMessage, ChatSessionState, ChatTurnResult } from "../types/chat.js";
import { parseSlashCommand, type ParsedSlashCommand } from "../lib/chatCommands.js";
import { ConfigService } from "./configService.js";
import { CodeContextService, isWorkspacePath } from "./codeContextService.js";
import { ChatSessionService } from "./chatSessionService.js";
import { OllamaClient } from "./ollamaClient.js";
import { RagClient } from "./ragClient.js";

export class ChatService {
  constructor(
    private readonly configService: ConfigService,
    private readonly sessionStore: ChatSessionService,
    private readonly ragClient: RagClient,
    private readonly ollamaClient: OllamaClient,
    private readonly codeContextService: CodeContextService,
  ) {}

  async createInitialSession(config: AegisConfig): Promise<ChatSessionState> {
    const cwd = process.cwd();
    const session = await this.sessionStore.load({
      mode: "code",
      behavior: "chat",
      model: config.runtime.model,
      collection: config.runtime.collection,
      cwd,
      history: [],
    });
    return {
      ...session,
      history: [],
    };
  }

  async handleInput(value: string, session: ChatSessionState): Promise<ChatTurnResult> {
    const trimmed = value.trim();
    if (!trimmed) {
      return { session };
    }

    const nextSession = appendMessage(session, { role: "user", text: trimmed });
    const command = parseSlashCommand(trimmed);
    if (command) {
      return this.handleCommand(command, nextSession);
    }

    if (nextSession.mode === "docs") {
      const response = await this.ragClient.query(trimmed, nextSession.collection, nextSession.model, 6);
      const sources = response.sources.map((source) => `${source.file_name}#${source.chunk_index}`).join(", ");
      const text = [
        response.answer,
        sources ? `Sources: ${sources}` : "",
        response.uncertainty ? `Uncertainty: ${response.uncertainty}` : "",
      ]
        .filter(Boolean)
        .join("\n\n");

      nextSession.history.push({ role: "assistant", text });
      await this.sessionStore.save(nextSession);
      return { session: nextSession };
    }

    const prompt = await this.codeContextService.buildPrompt({
      cwd: nextSession.cwd,
      question: trimmed,
      model: nextSession.model,
      behavior: nextSession.behavior,
      history: nextSession.history.filter(
        (message): message is Extract<ChatMessage, { role: "user" | "assistant" }> => message.role !== "system",
      ),
    });
    const answer = await this.ollamaClient.generate(nextSession.model, prompt);
    nextSession.history.push({ role: "assistant", text: answer });
    await this.sessionStore.save(nextSession);
    return { session: nextSession };
  }

  private async handleCommand(
    command: ParsedSlashCommand,
    session: ChatSessionState,
  ): Promise<ChatTurnResult> {
    switch (command.type) {
      case "help":
        return this.reply(
          session,
          SLASH_COMMANDS.map((commandDefinition) => `${commandDefinition.usage} — ${commandDefinition.description}`).join(
            "\n",
          ),
          "system",
          "help",
        );
      case "mode":
        if (!command.mode) {
          return this.reply(session, `Current mode: ${session.mode}`, "system");
        }

        session.mode = command.mode;
        return this.reply(session, `Switched to ${command.mode} mode.`, "system");
      case "model":
        if (!command.model) {
          const models = await this.ollamaClient.listModels();
          const available = models.map((model) => model.name).join(", ") || "none";
          return this.reply(session, `Current model: ${session.model}\nInstalled models: ${available}`, "system");
        }

        const models = await this.ollamaClient.listModels();
        const exists = models.some((model) => model.name === command.model);
        if (!exists) {
          return this.reply(
            session,
            `Model ${command.model} is not installed locally. Install it with \`ollama pull ${command.model}\`.`,
            "system",
          );
        }

        session.model = command.model;
        await this.configService.selectModel(command.model);
        return this.reply(session, `Switched model to ${command.model}.`, "system");
      case "resume": {
        const resumed = await this.sessionStore.resume(session.cwd, session);
        const withNotice = appendMessage(resumed, { role: "system", text: `Resumed session for ${resumed.cwd}.` });
        await this.sessionStore.save(withNotice);
        return { session: withNotice };
      }
      case "review":
        session.mode = "code";
        session.behavior = command.enabled ? "review" : "chat";
        return this.reply(
          session,
          command.enabled ? "Code review mode enabled." : "Returned to normal code chat mode.",
          "system",
        );
      case "cwd":
        if (!command.path) {
          return this.reply(session, `Current workspace: ${session.cwd}`, "system");
        }

        if (!(await isWorkspacePath(command.path))) {
          return this.reply(session, `Path is not a readable directory: ${command.path}`, "system");
        }

        session.cwd = path.resolve(command.path);
        return this.reply(session, `Workspace changed to ${session.cwd}`, "system");
      case "files": {
        const files = await this.codeContextService.listFiles(session.cwd);
        return this.reply(session, `Workspace files:\n${files.map((file) => `- ${file}`).join("\n") || "- none"}`, "system");
      }
      case "clear": {
        const cleared = await this.sessionStore.clear(session);
        return {
          session: appendMessage(cleared, { role: "system", text: "Session history cleared." }),
        };
      }
      case "collection":
        if (!command.collection) {
          return this.reply(session, `Current collection: ${session.collection}`, "system");
        }

        session.collection = command.collection;
        return this.reply(session, `Switched collection to ${command.collection}.`, "system");
      case "unknown":
        return this.reply(session, `Unknown slash command: /${command.command}`, "system");
    }
  }

  private async reply(
    session: ChatSessionState,
    text: string,
    role: ChatMessage["role"] = "assistant",
    variant: ChatMessage["variant"] = "default",
  ): Promise<ChatTurnResult> {
    const nextSession = appendMessage(session, { role, text, variant });
    await this.sessionStore.save(nextSession);
    return { session: nextSession };
  }
}

function appendMessage(
  session: ChatSessionState,
  message: Pick<ChatMessage, "role" | "text"> & Partial<Pick<ChatMessage, "variant">>,
): ChatSessionState {
  return {
    ...session,
    history: [...session.history, message],
  };
}
