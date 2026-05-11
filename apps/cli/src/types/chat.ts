export type ChatMode = "docs" | "code";
export type ChatBehavior = "chat" | "review";

export interface ChatMessage {
  role: "user" | "assistant";
  text: string;
}

export interface ChatSessionState {
  mode: ChatMode;
  behavior: ChatBehavior;
  model: string;
  collection: string;
  cwd: string;
  history: ChatMessage[];
}

export interface ChatTurnResult {
  session: ChatSessionState;
}
