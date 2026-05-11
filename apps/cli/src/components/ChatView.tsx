import React, { useState } from "react";
import { Box, Text, useApp, useInput } from "ink";
import Spinner from "ink-spinner";
import TextInput from "ink-text-input";

import type { ChatSessionState, ChatTurnResult } from "../types/chat.js";

interface ChatViewProps {
  initialSession: ChatSessionState;
  onSubmit: (value: string, session: ChatSessionState) => Promise<ChatTurnResult>;
}

export function ChatView({ initialSession, onSubmit }: ChatViewProps) {
  const { exit } = useApp();
  const [session, setSession] = useState(initialSession);
  const [input, setInput] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useInput((value, key) => {
    if (key.ctrl && value === "c") {
      exit();
    }
  });

  const submit = async () => {
    const trimmed = input.trim();
    if (!trimmed || pending) {
      return;
    }

    setPending(true);
    setError(null);
    setInput("");

    try {
      const response = await onSubmit(trimmed, session);
      setSession(response.session);
    } catch (submissionError) {
      setError(submissionError instanceof Error ? submissionError.message : "Unknown chat error");
    } finally {
      setPending(false);
    }
  };

  return (
    <Box flexDirection="column">
      <Text color="cyan">
        Chat | {session.model} | {session.mode} | {session.behavior} | {session.collection}
      </Text>
      <Text dimColor>Workspace: {session.cwd}</Text>
      <Box flexDirection="column" marginTop={1}>
        {session.history.length === 0 ? (
          <Text dimColor>
            {session.mode === "docs"
              ? "Ask a grounded question about your local knowledge base."
              : "Ask about the current workspace, or use /review for code review mode."}
          </Text>
        ) : null}
        {session.history.map((message, index) => (
          <Box key={`${message.role}-${index}`} flexDirection="column" marginBottom={1}>
            <Text color={message.role === "user" ? "yellow" : "green"}>
              {message.role === "user" ? "You" : "Assistant"}
            </Text>
            <Text>{message.text}</Text>
          </Box>
        ))}
      </Box>
      {error ? <Text color="red">{error}</Text> : null}
      <Box marginTop={1}>
        <Text color="yellow">{"> "}</Text>
        <TextInput
          value={input}
          onChange={setInput}
          onSubmit={() => {
            void submit();
          }}
        />
      </Box>
      <Box marginTop={1}>
        {pending ? (
          <Text color="cyan">
            <Spinner type="dots" /> Resolving local context...
          </Text>
        ) : (
          <Text dimColor>[Enter] send  [Ctrl+C] exit  [/help] commands</Text>
        )}
      </Box>
    </Box>
  );
}
