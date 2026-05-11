import { createHash } from "node:crypto";
import path from "node:path";

import Conf from "conf";

import { ROOT_DIR } from "../lib/constants.js";
import type { ChatBehavior, ChatMessage, ChatMode, ChatSessionState } from "../types/chat.js";

interface StoredChatState {
  mode: ChatMode;
  behavior: ChatBehavior;
  model: string;
  collection: string;
  cwd: string;
  history: ChatMessage[];
}

export class ChatSessionService {
  private readonly store = new Conf<Record<string, StoredChatState>>({
    projectName: "aegis",
    configName: "chat-session",
    cwd: process.env.AEGIS_STATE_DIR ?? path.join(ROOT_DIR, "data/config"),
  });

  async load(defaults: Omit<ChatSessionState, "history"> & { history?: ChatMessage[] }): Promise<ChatSessionState> {
    const persisted = this.store.get(this.key(defaults.cwd));
    return {
      mode: persisted?.mode ?? defaults.mode,
      behavior: persisted?.behavior ?? defaults.behavior,
      model: persisted?.model ?? defaults.model,
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
          collection: persisted.collection,
          cwd: persisted.cwd,
          history: persisted.history,
        }
      : fallback;
  }

  async save(session: ChatSessionState): Promise<void> {
    this.store.set(this.key(session.cwd), { ...session, history: pruneHistory(session.history) });
  }

  async clear(session: ChatSessionState): Promise<ChatSessionState> {
    const cleared = { ...session, history: [] };
    await this.save(cleared);
    return cleared;
  }

  private key(cwd: string): string {
    return createHash("sha1").update(cwd).digest("hex");
  }
}

function pruneHistory(history: ChatMessage[], limit = 20): ChatMessage[] {
  return history.slice(-limit);
}
