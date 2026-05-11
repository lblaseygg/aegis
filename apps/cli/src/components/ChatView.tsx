import React, { useState } from "react";
import { Box, Text, useApp, useInput } from "ink";
import Spinner from "ink-spinner";
import TextInput from "ink-text-input";

import type { QueryResponse } from "../types/rag.js";

interface Message {
  role: "user" | "assistant";
  text: string;
}

interface ChatViewProps {
  model: string;
  collection: string;
  onSubmit: (value: string) => Promise<QueryResponse>;
}

export function ChatView({ model, collection, onSubmit }: ChatViewProps) {
  const { exit } = useApp();
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
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
    setMessages((current) => [...current, { role: "user", text: trimmed }]);
    setInput("");

    try {
      const response = await onSubmit(trimmed);
      const sources = response.sources.map((source) => source.file_name).join(", ");
      const answer = sources ? `${response.answer}\n\nSources: ${sources}` : response.answer;
      setMessages((current) => [...current, { role: "assistant", text: answer }]);
    } catch (submissionError) {
      setError(submissionError instanceof Error ? submissionError.message : "Unknown chat error");
    } finally {
      setPending(false);
    }
  };

  return (
    <Box flexDirection="column">
      <Text color="cyan">
        Chat | {model} | {collection}
      </Text>
      <Box flexDirection="column" marginTop={1}>
        {messages.length === 0 ? <Text dimColor>Ask a grounded question about your local knowledge base.</Text> : null}
        {messages.map((message, index) => (
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
            <Spinner type="dots" /> Querying local context...
          </Text>
        ) : (
          <Text dimColor>[Enter] send  [Ctrl+C] exit</Text>
        )}
      </Box>
    </Box>
  );
}
