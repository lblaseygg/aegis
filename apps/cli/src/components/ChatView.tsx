import os from "node:os";

import React, { useState } from "react";
import { Box, Text, useApp, useInput } from "ink";
import Spinner from "ink-spinner";
import TextInput from "ink-text-input";

import packageJson from "../../package.json" with { type: "json" };
import type { ChatSessionState, ChatTurnResult } from "../types/chat.js";

const AEGIS_ASCII = `░▒▓██████▓▒░░▒▓████████▓▒░▒▓██████▓▒░░▒▓█▓▒░░▒▓███████▓▒░
░▒▓█▓▒░░▒▓█▓▒░▒▓█▓▒░     ░▒▓█▓▒░░▒▓█▓▒░▒▓█▓▒░▒▓█▓▒░
░▒▓█▓▒░░▒▓█▓▒░▒▓█▓▒░     ░▒▓█▓▒░      ░▒▓█▓▒░▒▓█▓▒░
░▒▓████████▓▒░▒▓██████▓▒░░▒▓█▓▒▒▓███▓▒░▒▓█▓▒░░▒▓██████▓▒░
░▒▓█▓▒░░▒▓█▓▒░▒▓█▓▒░     ░▒▓█▓▒░░▒▓█▓▒░▒▓█▓▒░      ░▒▓█▓▒░
░▒▓█▓▒░░▒▓█▓▒░▒▓█▓▒░     ░▒▓█▓▒░░▒▓█▓▒░▒▓█▓▒░      ░▒▓█▓▒░
░▒▓█▓▒░░▒▓█▓▒░▒▓████████▓▒░▒▓██████▓▒░░▒▓█▓▒░▒▓███████▓▒░`;

const LAUNCH_QUOTES = [
  {
    text: "Never give up on something that you can't go a day without thinking about.",
    author: "Winston Churchill",
  },
  {
    text: "Never give up, for that is just the place and time that the tide will turn.",
    author: "Harriet Beecher Stowe",
  },
  {
    text: "It always seems impossible until it's done.",
    author: "Nelson Mandela",
  },
  {
    text: "The joy of living is his who has the heart to demand it.",
    author: "Theodore Roosevelt",
  },
  {
    text: "The farther one gets into the wilderness, the greater is the attraction of its lonely freedom.",
    author: "Theodore Roosevelt",
  },
];

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
  const [placeholder] = useState(() => pickPlaceholder(initialSession));
  const [launchQuote] = useState(() => pickLaunchQuote());

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
    <Box flexDirection="column" height="100%">
      <Box flexShrink={0} flexDirection="column">
        <Text color="white">{AEGIS_ASCII}</Text>
        <Box
          borderStyle="round"
          borderColor="white"
          flexDirection="column"
          alignSelf="flex-start"
          marginTop={1}
          paddingX={1}
        >
          <Box>
            <Text dimColor>{">_"}</Text>
            <Text bold color="white">
              {" Aegis "}
            </Text>
            <Text dimColor>({packageJson.version})</Text>
          </Box>
          <Text dimColor>"{launchQuote.text}"</Text>
          <Text dimColor>— {launchQuote.author}</Text>
        </Box>
      </Box>
      <Box flexDirection="column" flexGrow={1} justifyContent="flex-end" marginTop={1} overflow="hidden">
        <Box flexDirection="column">
          {session.history.map((message, index) => (
            <Box key={`${message.role}-${index}`} flexDirection="column" marginBottom={1}>
              <Text color={message.role === "user" ? "yellow" : "green"}>
                {message.role === "user" ? "You" : "Assistant"}
              </Text>
              <Text>{message.text}</Text>
            </Box>
          ))}
        </Box>
      </Box>
      {error ? <Text color="red">{error}</Text> : null}
      <Box
        borderStyle="round"
        borderColor="white"
        flexDirection="column"
        flexShrink={0}
        marginTop={1}
        paddingX={1}
        paddingY={0}
      >
        <Box>
          <Text color="yellow">{"> "}</Text>
          <TextInput
            value={input}
            placeholder={placeholder}
            onChange={setInput}
            onSubmit={() => {
              void submit();
            }}
          />
        </Box>
      </Box>
      <Box flexShrink={0} marginTop={0} paddingLeft={3}>
        {pending ? (
          <Text color="cyan">
            <Spinner type="dots" /> Resolving local context...
          </Text>
        ) : (
          <Text dimColor>
            {session.model}  |  {formatWorkspacePath(session.cwd)}
          </Text>
        )}
      </Box>
    </Box>
  );
}

function pickPlaceholder(session: ChatSessionState): string {
  const workspaceExamples = [
    "Improve documentation in @filename",
    "Review the changes in @package.json",
    "Explain how @src/index.ts fits into the app",
    "Find risky code paths in @app/main.py",
    "Ask about the current workspace",
  ];
  const docsExamples = [
    "Summarize the onboarding guide in @docs/README.md",
    "Pull the key policy changes from @security-policy.md",
    "Compare procedures in @runbook.md",
  ];
  const options = session.mode === "docs" ? docsExamples : workspaceExamples;
  return options[Math.floor(Math.random() * options.length)] ?? workspaceExamples[0];
}

function formatWorkspacePath(cwd: string): string {
  const home = os.homedir();
  return cwd.startsWith(home) ? cwd.replace(home, "~") : cwd;
}

function pickLaunchQuote(): (typeof LAUNCH_QUOTES)[number] {
  return LAUNCH_QUOTES[Math.floor(Math.random() * LAUNCH_QUOTES.length)] ?? LAUNCH_QUOTES[0];
}
