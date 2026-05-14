import path from "node:path";

import { SLASH_COMMANDS } from "../lib/chatCommands.js";
import type { AegisConfig } from "../types/config.js";
import type { ChatMessage, ChatProgressUpdate, ChatSessionState, ChatTurnResult } from "../types/chat.js";
import { parseSlashCommand, type ParsedSlashCommand } from "../lib/chatCommands.js";
import { ConfigService } from "./configService.js";
import { CodeContextService, isWorkspacePath } from "./codeContextService.js";
import { ChatSessionService } from "./chatSessionService.js";
import { ModelRouterService, resolveInstalledModelName } from "./modelRouterService.js";
import { OllamaClient, parseThinkingEnvelope } from "./ollamaClient.js";
import { RagClient } from "./ragClient.js";

export class ChatService {
  constructor(
    private readonly configService: ConfigService,
    private readonly sessionStore: ChatSessionService,
    private readonly ragClient: RagClient,
    private readonly ollamaClient: OllamaClient,
    private readonly codeContextService: CodeContextService,
    private readonly modelRouter = new ModelRouterService(),
  ) {}

  async createInitialSession(config: AegisConfig): Promise<ChatSessionState> {
    const cwd = process.cwd();
    const session = await this.sessionStore.load({
      mode: "code",
      behavior: "chat",
      model: config.runtime.model,
      selectionMode: config.runtime.selection,
      modelProfiles: config.runtime.model_profiles,
      lastResolvedModel: config.runtime.selection === "auto" ? undefined : config.runtime.model,
      collection: config.runtime.collection,
      cwd,
      history: [],
    });
    return {
      ...session,
      model: config.runtime.model,
      selectionMode: config.runtime.selection,
      modelProfiles: config.runtime.model_profiles,
      lastResolvedModel: config.runtime.selection === "auto" ? undefined : config.runtime.model,
      collection: config.runtime.collection,
      history: [],
    };
  }

  async handleInput(
    value: string,
    session: ChatSessionState,
    onProgress?: (update: ChatProgressUpdate) => void,
  ): Promise<ChatTurnResult> {
    const trimmed = value.trim();
    if (!trimmed) {
      return { session };
    }

    const nextSession = appendMessage(session, { role: "user", text: trimmed });
    const command = parseSlashCommand(trimmed);
    if (command) {
      return this.handleCommand(command, nextSession);
    }

    const resolvedModel = await this.resolveModel(nextSession, trimmed);
    nextSession.lastResolvedModel = resolvedModel;

    if (nextSession.mode === "docs") {
      const response = await this.ragClient.query(trimmed, nextSession.collection, resolvedModel, 6);
      const parsedAnswer = parseThinkingEnvelope(response.answer);
      const sources = response.sources.map((source) => `${source.file_name}#${source.chunk_index}`).join(", ");
      const text = [
        parsedAnswer.answer,
        sources ? `Sources: ${sources}` : "",
        response.uncertainty ? `Uncertainty: ${response.uncertainty}` : "",
      ]
        .filter(Boolean)
        .join("\n\n");

      if (!parsedAnswer.answer.trim()) {
        throw new Error("The model returned an empty response.");
      }

      nextSession.history.push({ role: "assistant", text });
      await this.sessionStore.save(nextSession);
      return { session: nextSession };
    }

    const prompt = await this.codeContextService.buildPrompt({
      cwd: nextSession.cwd,
      question: trimmed,
      model: resolvedModel,
      behavior: nextSession.behavior,
      history: nextSession.history.filter(
        (message): message is Extract<ChatMessage, { role: "user" | "assistant" }> => message.role !== "system",
      ),
    });
    const answer = await this.ollamaClient.generate(resolvedModel, prompt, onProgress);
    if (!answer.trim()) {
      throw new Error("The model returned an empty response.");
    }
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
      case "auto":
        session.selectionMode = "auto";
        await this.configService.selectModelSelectionMode("auto");
        return this.reply(session, "Automatic model routing enabled.", "system");
      case "manual":
        session.selectionMode = "manual";
        await this.configService.selectModelSelectionMode("manual");
        if (!command.model) {
          return this.reply(session, `Manual mode enabled. Current model: ${session.model}`, "system");
        }

        return this.selectManualModel(session, command.model);
      case "model":
        if (!command.model) {
          const models = await this.ollamaClient.listModels();
          const available = models.map((model) => model.name).join(", ") || "none";
          const profiles = [
            `fast_general=${session.modelProfiles.fast_general}`,
            `long_running=${session.modelProfiles.long_running}`,
            `coding_optimized=${session.modelProfiles.coding_optimized}`,
            `coding_fast=${session.modelProfiles.coding_fast}`,
            `coding_strong=${session.modelProfiles.coding_strong}`,
          ].join("\n");
          return this.reply(
            session,
            `Selection mode: ${session.selectionMode}\nManual model: ${session.model}\nLast used: ${session.lastResolvedModel ?? session.model}\nInstalled models: ${available}\nProfiles:\n${profiles}`,
            "system",
          );
        }

        return this.configureModel(session, command.model);
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

  private async resolveModel(session: ChatSessionState, prompt: string): Promise<string> {
    const installedModels = (await this.ollamaClient.listModels()).map((model) => model.name);
    const resolved = this.modelRouter.resolve({
      prompt,
      mode: session.mode,
      behavior: session.behavior,
      manualModel: session.model,
      selectionMode: session.selectionMode,
      modelProfiles: session.modelProfiles,
      installedModels,
    });
    return resolved.model;
  }

  private async selectManualModel(session: ChatSessionState, model: string): Promise<ChatTurnResult> {
    const models = await this.ollamaClient.listModels();
    const resolvedModel = resolveInstalledModelName(
      model,
      models.map((entry) => entry.name),
    );
    if (!resolvedModel) {
      return this.reply(
        session,
        `Model ${model} is not installed locally. Install it with \`ollama pull ${model}\`.`,
        "system",
      );
    }

    session.model = resolvedModel;
    session.selectionMode = "manual";
    session.lastResolvedModel = resolvedModel;
    await this.configService.selectModel(resolvedModel);
    await this.configService.selectModelSelectionMode("manual");
    return this.reply(session, `Manual model set to ${resolvedModel}.`, "system");
  }

  private async configureModel(session: ChatSessionState, model: string): Promise<ChatTurnResult> {
    const models = await this.ollamaClient.listModels();
    const resolvedModel = resolveInstalledModelName(
      model,
      models.map((entry) => entry.name),
    );
    if (!resolvedModel) {
      return this.reply(
        session,
        `Model ${model} is not installed locally. Install it with \`ollama pull ${model}\`.`,
        "system",
      );
    }

    session.model = resolvedModel;
    if (session.selectionMode === "manual") {
      session.lastResolvedModel = resolvedModel;
    }
    await this.configService.selectModel(resolvedModel);
    const message =
      session.selectionMode === "auto"
        ? `Updated the manual fallback model to ${resolvedModel}. Automatic routing is still enabled.`
        : `Manual model set to ${resolvedModel}.`;
    return this.reply(session, message, "system");
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
