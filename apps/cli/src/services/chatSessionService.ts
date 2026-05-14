import { createHash } from "node:crypto";
import { mkdir } from "node:fs/promises";
import path from "node:path";

import Conf from "conf";

import { DEFAULT_STATE_DIR } from "../lib/constants.js";
import type { ChatBehavior, ChatMessage, ChatMode, ChatSessionState } from "../types/chat.js";
import type { ModelProfiles, ModelSelectionMode } from "../types/config.js";

interface StoredChatState {
  mode: ChatMode;
  behavior: ChatBehavior;
  model: string;
  selectionMode: ModelSelectionMode;
  modelProfiles: ModelProfiles;
  lastResolvedModel?: string;
  collection: string;
  cwd: string;
  history: ChatMessage[];
}

export class ChatSessionService {
  private warnedOnPersistenceFailure = false;
  private readonly store = new Conf<Record<string, StoredChatState>>({
    projectName: "aegis",
    configName: "chat-session",
    cwd: DEFAULT_STATE_DIR,
  });

  async load(defaults: Omit<ChatSessionState, "history"> & { history?: ChatMessage[] }): Promise<ChatSessionState> {
    const persisted = this.store.get(this.key(defaults.cwd));
    return {
      mode: persisted?.mode ?? defaults.mode,
      behavior: persisted?.behavior ?? defaults.behavior,
      model: persisted?.model ?? defaults.model,
      selectionMode: persisted?.selectionMode ?? defaults.selectionMode,
      modelProfiles: persisted?.modelProfiles ?? defaults.modelProfiles,
      lastResolvedModel: persisted?.lastResolvedModel ?? defaults.lastResolvedModel,
      collection: persisted?.collection ?? defaults.collection,
      cwd: persisted?.cwd ?? defaults.cwd,
      history: persisted?.history ?? defaults.history ?? [],
    };
  }

  async resume(cwd: string, fallback: ChatSessionState): Promise<ChatSessionState> {
    const persisted = this.store.get(this.key(cwd));
    return persisted
      ? {
          mode: persisted.mode,
          behavior: persisted.behavior,
          model: persisted.model,
          selectionMode: persisted.selectionMode ?? fallback.selectionMode,
          modelProfiles: persisted.modelProfiles ?? fallback.modelProfiles,
          lastResolvedModel: persisted.lastResolvedModel ?? fallback.lastResolvedModel,
          collection: persisted.collection,
          cwd: persisted.cwd,
          history: persisted.history,
        }
      : fallback;
  }

  async save(session: ChatSessionState): Promise<void> {
    try {
      await mkdir(DEFAULT_STATE_DIR, { recursive: true });
      this.store.set(this.key(session.cwd), { ...session, history: pruneHistory(session.history) });
    } catch (error) {
      this.warnOnPersistenceFailure(error);
    }
  }

  async clear(session: ChatSessionState): Promise<ChatSessionState> {
    const cleared = { ...session, history: [] };
    await this.save(cleared);
    return cleared;
  }

  private key(cwd: string): string {
    return createHash("sha1").update(cwd).digest("hex");
  }

  private warnOnPersistenceFailure(error: unknown): void {
    if (this.warnedOnPersistenceFailure) {
      return;
    }

    this.warnedOnPersistenceFailure = true;
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`Aegis session persistence is unavailable: ${message}`);
  }
}

function pruneHistory(history: ChatMessage[], limit = 20): ChatMessage[] {
  return history.slice(-limit);
}
