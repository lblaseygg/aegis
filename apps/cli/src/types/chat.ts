import type { ModelProfiles, ModelSelectionMode } from "./config.js";

export type ChatMode = "docs" | "code";
export type ChatBehavior = "chat" | "review";
export type ChatMessageRole = "user" | "assistant" | "system";
export type ChatMessageVariant = "default" | "help";

export interface ChatMessage {
  role: ChatMessageRole;
  text: string;
  variant?: ChatMessageVariant;
}

export interface ChatSessionState {
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

export interface ChatTurnResult {
  session: ChatSessionState;
}

export interface ChatProgressUpdate {
  model: string;
  phase: "working" | "thinking";
  thinking?: string;
}
