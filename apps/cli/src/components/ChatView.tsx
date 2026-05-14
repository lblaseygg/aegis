import os from "node:os";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { execa } from "execa";
import { Box, Text, useApp, useInput, useStdin, useStdout } from "ink";
import Spinner from "ink-spinner";

import packageJson from "../../package.json" with { type: "json" };
import { matchSlashCommands } from "../lib/chatCommands.js";
import type { ChatMessage, ChatProgressUpdate, ChatSessionState, ChatTurnResult } from "../types/chat.js";

const AEGIS_ACCENT = "#FFFFF1";
const USER_PROMPT_COLOR = "#22d3ee";
const INPUT_PROMPT_INDENT = 2;
const INPUT_CONTENT_INDENT = 4;
const INPUT_BOX_INDENT = 1;

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
  availableModels: string[];
  onSubmit: (value: string, session: ChatSessionState, onProgress?: (update: ChatProgressUpdate) => void) => Promise<ChatTurnResult>;
}

interface RenderedHistoryLine {
  id: string;
  text: string;
  color?: string;
  dimColor?: boolean;
  bold?: boolean;
  segments?: Array<{
    text: string;
    color?: string;
    dimColor?: boolean;
    bold?: boolean;
  }>;
}

interface InputSuggestion {
  label: string;
  description: string;
  completion: string;
}

interface FooterLineProps {
  width: number;
  directory: string;
  branchLabel: string | null;
  model: string;
}

export function ChatView({ initialSession, availableModels, onSubmit }: ChatViewProps) {
  const { exit } = useApp();
  const { stdin } = useStdin();
  const { stdout } = useStdout();
  const [session, setSession] = useState(initialSession);
  const [input, setInput] = useState("");
  const [cursorIndex, setCursorIndex] = useState(0);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [placeholder] = useState(() => pickPlaceholder(initialSession));
  const [launchQuote] = useState(() => pickLaunchQuote());
  const [isTerminalFocused, setIsTerminalFocused] = useState(true);
  const [historyLineOffset, setHistoryLineOffset] = useState(0);
  const [branchLabel, setBranchLabel] = useState<string | null>(null);
  const [completionIndex, setCompletionIndex] = useState(0);
  const [progressUpdate, setProgressUpdate] = useState<ChatProgressUpdate | null>(null);

  const inputSuggestions = useMemo(() => buildInputSuggestions(input, availableModels), [availableModels, input]);
  const historyWidth = Math.max(24, (stdout.columns ?? 80) - 2);
  const renderedContentLines = useMemo(
    () => [...renderHeaderLines(launchQuote, historyWidth), ...renderHistoryLines(session.history, historyWidth)],
    [historyWidth, launchQuote, session.history],
  );
  const maxVisibleHistoryLines = useMemo(
    () => estimateVisibleHistoryLines(stdout.rows ?? 24, inputSuggestions.length, Boolean(error), pending),
    [error, pending, inputSuggestions.length, stdout.rows],
  );
  const maxHistoryLineOffset = Math.max(0, renderedContentLines.length - maxVisibleHistoryLines);
  const visibleContentLines = useMemo(
    () => sliceVisibleHistory(renderedContentLines, maxVisibleHistoryLines, historyLineOffset),
    [historyLineOffset, maxVisibleHistoryLines, renderedContentLines],
  );
  useEffect(() => {
    let isCancelled = false;

    const loadBranch = async () => {
      const branch = await readBranchLabel(session.cwd);
      if (!isCancelled) {
        setBranchLabel(branch);
      }
    };

    void loadBranch();

    return () => {
      isCancelled = true;
    };
  }, [session.cwd]);

  useEffect(() => {
    if (!stdout.isTTY) {
      return;
    }

    stdout.write("\u001B[?1004h");

    const handleData = (chunk: Buffer | string) => {
      const value = typeof chunk === "string" ? chunk : chunk.toString("utf8");
      if (value.includes("\u001B[I")) {
        setIsTerminalFocused(true);
      }

      if (value.includes("\u001B[O")) {
        setIsTerminalFocused(false);
      }
    };

    stdin.on("data", handleData);

    return () => {
      stdin.off("data", handleData);
      stdout.write("\u001B[?1004l");
    };
  }, [stdin, stdout]);

  useInput((value, key) => {
    const isBackspace = key.backspace || key.delete || value === "\u007f" || value === "\b";
    const isForwardDelete = value === "\u001b[3~";

    if (key.ctrl && value === "c") {
      exit();
      return;
    }

    if (key.return) {
      void submit();
      return;
    }

    if (key.tab) {
      if (inputSuggestions.length === 0) {
        return;
      }

      const suggestion = inputSuggestions[completionIndex % inputSuggestions.length];
      setInput(suggestion.completion);
      setCursorIndex(suggestion.completion.length);
      setCompletionIndex((current) => (current + 1) % inputSuggestions.length);
      return;
    }

    if (key.upArrow) {
      if (inputSuggestions.length === 0) {
        return;
      }

      setCompletionIndex((current) => (current - 1 + inputSuggestions.length) % inputSuggestions.length);
      return;
    }

    if (key.downArrow) {
      if (inputSuggestions.length === 0) {
        return;
      }

      setCompletionIndex((current) => (current + 1) % inputSuggestions.length);
      return;
    }

    if (key.pageUp) {
      setHistoryLineOffset((current) =>
        Math.min(maxHistoryLineOffset, current + Math.max(1, maxVisibleHistoryLines - 1)),
      );
      return;
    }

    if (key.pageDown) {
      setHistoryLineOffset((current) => Math.max(0, current - Math.max(1, maxVisibleHistoryLines - 1)));
      return;
    }

    if (key.leftArrow) {
      setCursorIndex((current) => Math.max(0, current - 1));
      return;
    }

    if (key.rightArrow) {
      setCursorIndex((current) => Math.min(input.length, current + 1));
      return;
    }

    if (key.home) {
      setCursorIndex(0);
      return;
    }

    if (key.end) {
      setCursorIndex(input.length);
      return;
    }

    if (isBackspace || isForwardDelete) {
      if (isBackspace && cursorIndex > 0) {
        setInput((current) => `${current.slice(0, cursorIndex - 1)}${current.slice(cursorIndex)}`);
        setCursorIndex((current) => Math.max(0, current - 1));
        return;
      }

      if (isForwardDelete && cursorIndex < input.length) {
        setInput((current) => `${current.slice(0, cursorIndex)}${current.slice(cursorIndex + 1)}`);
        return;
      }
    }

    if (!value || key.ctrl || key.meta || key.escape || key.tab) {
      return;
    }

    const sanitizedValue = stripTerminalArtifacts(value);
    if (!sanitizedValue) {
      return;
    }

    setInput((current) => `${current.slice(0, cursorIndex)}${sanitizedValue}${current.slice(cursorIndex)}`);
    setCursorIndex((current) => current + sanitizedValue.length);
    setCompletionIndex(0);
  });

  const submit = async () => {
    const trimmed = input.trim();
    if (!trimmed || pending) {
      return;
    }

    setPending(true);
    setError(null);
    setInput("");
    setCursorIndex(0);
    setHistoryLineOffset(0);
    setCompletionIndex(0);
    setProgressUpdate(null);

    try {
      const response = await onSubmit(trimmed, session, (update) => setProgressUpdate(update));
      setSession(response.session);
    } catch (submissionError) {
      setError(submissionError instanceof Error ? submissionError.message : "Unknown chat error");
    } finally {
      setPending(false);
      setProgressUpdate(null);
    }
  };

  return (
    <Box flexDirection="column">
      <Box flexDirection="column" marginTop={1}>
        {visibleContentLines.map((line) => (
          <Text key={line.id} color={line.color} dimColor={line.dimColor} bold={line.bold}>
            {line.segments
              ? line.segments.map((segment, index) => (
                  <Text
                    key={`${line.id}-segment-${index}`}
                    color={segment.color}
                    dimColor={segment.dimColor}
                    bold={segment.bold}
                  >
                    {segment.text}
                  </Text>
                ))
              : (line.text || " ")}
          </Text>
        ))}
      </Box>

      {error ? <Text color="red">{error}</Text> : null}

      {inputSuggestions.length > 0 ? (
        <Box flexDirection="column" flexShrink={0} marginTop={0} paddingLeft={INPUT_CONTENT_INDENT}>
          {inputSuggestions.map((suggestion, index) => (
            <Text key={suggestion.label} dimColor={index !== completionIndex % inputSuggestions.length}>
              {suggestion.description ? `${suggestion.label}  —  ${suggestion.description}` : suggestion.label}
            </Text>
          ))}
        </Box>
      ) : null}

      <Box
        borderStyle="round"
        borderColor={AEGIS_ACCENT}
        borderDimColor={!isTerminalFocused}
        flexDirection="column"
        flexShrink={0}
        marginTop={0}
        paddingX={1}
        paddingY={0}
      >
        <Box>
          <Text color={isTerminalFocused ? "yellow" : AEGIS_ACCENT} dimColor={!isTerminalFocused}>
            {"> "}
          </Text>
          {renderInputContent(input, cursorIndex, placeholder, isTerminalFocused)}
        </Box>
      </Box>

        <Box flexDirection="column" flexShrink={0} marginTop={0} paddingLeft={INPUT_BOX_INDENT}>
        {pending ? (
          <Box flexDirection="column">
            <Text color="cyan">
              <Spinner type="dots" /> {progressUpdate?.phase === "thinking" ? "Thinking..." : "Working..."}
            </Text>
            {progressUpdate?.thinking ? (
              <Text dimColor>{progressUpdate.thinking}</Text>
            ) : null}
          </Box>
        ) : null}
        <FooterLine
          width={Math.max(24, (stdout.columns ?? 80) - INPUT_BOX_INDENT)}
          directory={formatWorkspacePath(session.cwd)}
          branchLabel={branchLabel}
          model={formatModelLabel(session)}
        />
      </Box>
    </Box>
  );
}

function FooterLine({ width, directory, branchLabel, model }: FooterLineProps) {
  const branchSuffix = branchLabel ? ` (${branchLabel})` : "";
  const maxLeftWidth = Math.max(12, Math.floor(width * 0.45));
  const clippedDirectory = truncateText(
    directory,
    branchSuffix.length > 0 ? Math.max(4, maxLeftWidth - branchSuffix.length) : maxLeftWidth,
  );
  const leftDisplay = `${clippedDirectory}${branchSuffix}`;
  const leftWidth = visualWidth(leftDisplay);

  return (
    <Box width={width}>
      <Box width={leftWidth}>
        <Text>{clippedDirectory}</Text>
        {branchLabel ? <Text dimColor>{branchSuffix}</Text> : null}
      </Box>
      <Box flexGrow={1} justifyContent="center">
        <Text dimColor>{model}</Text>
      </Box>
      <Box width={leftWidth}>
        <Text>{" ".repeat(leftWidth)}</Text>
      </Box>
    </Box>
  );
}

function formatModelLabel(session: ChatSessionState): string {
  if (session.selectionMode === "auto") {
    return session.lastResolvedModel ? `auto · ${session.lastResolvedModel}` : "auto";
  }

  return session.lastResolvedModel ?? session.model;
}

function buildInputSuggestions(input: string, availableModels: string[]): InputSuggestion[] {
  const trimmed = input.trimStart();
  const modelCommandMatch = trimmed.match(/^\/(model|manual)(?:\s+(.*))?$/);
  if (modelCommandMatch) {
    const command = modelCommandMatch[1];
    const query = (modelCommandMatch[2] ?? "").trim().toLowerCase();
    return availableModels
      .filter((model) => !query || model.toLowerCase().startsWith(query))
      .map((model) => ({
        label: model,
        description: command === "manual" ? "Set and pin this manual model." : "",
        completion: `/${command} ${model}`,
      }));
  }

  return matchSlashCommands(input).map((command) => ({
    label: command.usage,
    description: command.description,
    completion: command.usage.replace(/\s*\[.*$/, ""),
  }));
}

function renderHistoryLines(history: ChatMessage[], width: number): RenderedHistoryLine[] {
  return history.flatMap((message, index) => renderMessageLines(message, index, width));
}

function renderHeaderLines(
  launchQuote: (typeof LAUNCH_QUOTES)[number],
  width: number,
): RenderedHistoryLine[] {
  const innerWidth = Math.max(24, Math.min(60, width - 4));
  const quoteLines = wrapText(`"${launchQuote.text}"`, innerWidth);
  const authorLines = wrapText(`— ${launchQuote.author}`, innerWidth);
  const boxTop = `╭${"─".repeat(innerWidth + 2)}╮`;
  const boxBottom = `╰${"─".repeat(innerWidth + 2)}╯`;

  return [
    ...AEGIS_ASCII.split("\n").map((line, index) => ({
      id: `header-ascii-${index}`,
      text: line,
      color: AEGIS_ACCENT,
    })),
    { id: "header-spacer-0", text: "" },
    { id: "header-box-top", text: boxTop, color: AEGIS_ACCENT },
    {
      id: "header-box-title",
      text: "",
      segments: [
        { text: "│ ", color: AEGIS_ACCENT },
        { text: ">_ ", color: AEGIS_ACCENT, dimColor: true },
        { text: "Aegis", color: AEGIS_ACCENT, bold: true },
        { text: ` (${packageJson.version})`, color: AEGIS_ACCENT, dimColor: true },
        {
          text: `${" ".repeat(Math.max(0, innerWidth - visualWidth(`>_ Aegis (${packageJson.version})`)))} │`,
          color: AEGIS_ACCENT,
        },
      ],
    },
    ...quoteLines.map((line, index) => ({
      id: `header-box-quote-${index}`,
      text: "",
      segments: [
        { text: "│ ", color: AEGIS_ACCENT },
        { text: line.padEnd(innerWidth, " "), color: AEGIS_ACCENT, dimColor: true },
        { text: " │", color: AEGIS_ACCENT },
      ],
    })),
    ...authorLines.map((line, index) => ({
      id: `header-box-author-${index}`,
      text: "",
      segments: [
        { text: "│ ", color: AEGIS_ACCENT },
        { text: line.padEnd(innerWidth, " "), color: AEGIS_ACCENT, dimColor: true },
        { text: " │", color: AEGIS_ACCENT },
      ],
    })),
    { id: "header-box-bottom", text: boxBottom, color: AEGIS_ACCENT },
    { id: "header-spacer-1", text: "" },
  ];
}

function renderMessageLines(message: ChatMessage, index: number, width: number): RenderedHistoryLine[] {
  if (message.role === "system" && message.variant === "help") {
    return renderHelpBoxLines(message, index, width);
  }

  if (message.role === "system") {
    return [
      ...wrapText(message.text, width).map((line, lineIndex) => ({
        id: `history-${index}-system-${lineIndex}`,
        text: line,
        dimColor: true,
      })),
      {
        id: `history-${index}-system-spacer`,
        text: "",
      },
    ];
  }

  const labelColor = message.role === "user" ? USER_PROMPT_COLOR : "green";

  if (message.role === "user") {
    const wrappedBody = wrapText(message.text, Math.max(4, width - 2));
    return [
      ...wrappedBody.map((line, lineIndex) => ({
        id: `history-${index}-body-${lineIndex}`,
        text: `${lineIndex === 0 ? "> " : "  "}${line}`,
        color: labelColor,
      })),
      {
        id: `history-${index}-spacer`,
        text: "",
      },
    ];
  }

  return [
    ...wrapText(message.text, Math.max(4, width - 2)).map((line, lineIndex) => ({
      id: `history-${index}-body-${lineIndex}`,
      text: `${lineIndex === 0 ? "> " : "  "}${line}`,
      color: labelColor,
    })),
    {
      id: `history-${index}-spacer`,
      text: "",
    },
  ];
}

function renderHelpBoxLines(message: ChatMessage, index: number, width: number): RenderedHistoryLine[] {
  const header = "Commands:";
  const maxInnerWidth = Math.max(16, width - 4);
  const wrappedLines = [header, ...message.text.split("\n")].flatMap((line) => wrapText(line, maxInnerWidth));
  const innerWidth = Math.max(...wrappedLines.map((line) => visualWidth(line)), visualWidth(header));
  const top = `╭${"─".repeat(innerWidth + 2)}╮`;
  const bottom = `╰${"─".repeat(innerWidth + 2)}╯`;

  return [
    { id: `history-${index}-help-top`, text: top, color: AEGIS_ACCENT },
    ...wrappedLines.map((line, lineIndex) => ({
      id: `history-${index}-help-${lineIndex}`,
      text: `│ ${line.padEnd(innerWidth, " ")} │`,
      color: lineIndex === 0 ? "white" : undefined,
      bold: lineIndex === 0,
    })),
    { id: `history-${index}-help-bottom`, text: bottom, color: AEGIS_ACCENT },
    { id: `history-${index}-help-spacer`, text: "" },
  ];
}

function wrapText(text: string, width: number): string[] {
  const paragraphs = text.split("\n");
  const lines: string[] = [];

  for (const paragraph of paragraphs) {
    if (!paragraph) {
      lines.push("");
      continue;
    }

    let current = "";
    for (const word of paragraph.split(/\s+/)) {
      if (!word) {
        continue;
      }

      if (visualWidth(word) > width) {
        if (current) {
          lines.push(current);
          current = "";
        }

        const chunks = chunkText(word, width);
        lines.push(...chunks.slice(0, -1));
        current = chunks.at(-1) ?? "";
        continue;
      }

      const next = current ? `${current} ${word}` : word;
      if (visualWidth(next) <= width) {
        current = next;
      } else {
        lines.push(current);
        current = word;
      }
    }

    if (current) {
      lines.push(current);
    }
  }

  return lines.length > 0 ? lines : [""];
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

function stripTerminalArtifacts(value: string): string {
  return value
    .replace(/\u001b\[[IO0]/g, "")
    .replace(/\[(?:I|O|0)/g, "")
    .replace(/\u001b\[<\d+;\d+;\d+[mM]/g, "")
    .replace(/\[<\d+;\d+;\d+[mM]/g, "");
}

function estimateVisibleHistoryLines(
  rows: number,
  slashCommandCount: number,
  hasError: boolean,
  pending: boolean,
): number {
  const reservedRows = 5 + slashCommandCount + (hasError ? 1 : 0) + (pending ? 1 : 0);
  return Math.max(4, rows - reservedRows);
}

function renderInputContent(input: string, cursorIndex: number, placeholder: string, isTerminalFocused: boolean) {
  const beforeCursor = input.slice(0, cursorIndex);
  const currentCharacter = input[cursorIndex] ?? " ";
  const afterCursor = input.slice(cursorIndex + (cursorIndex < input.length ? 1 : 0));

  if (!input) {
    return (
      <Box>
        <Text inverse={isTerminalFocused}> </Text>
        <Text dimColor>{placeholder}</Text>
      </Box>
    );
  }

  return (
    <Box>
      <Text>{beforeCursor}</Text>
      <Text inverse={isTerminalFocused}>{currentCharacter}</Text>
      <Text>{afterCursor}</Text>
    </Box>
  );
}

function sliceVisibleHistory<T>(history: T[], maxVisibleLines: number, historyOffset: number): T[] {
  const end = Math.max(0, history.length - historyOffset);
  const start = Math.max(0, end - maxVisibleLines);
  return history.slice(start, end);
}

function parseMouseScroll(value: string): Array<"up" | "down"> {
  const matches = [...value.matchAll(/\u001b\[<(\d+);(\d+);(\d+)([mM])/g)];
  return matches.flatMap((match) => {
    const code = Number.parseInt(match[1], 10);
    if (code === 64) {
      return ["up"] as const;
    }

    if (code === 65) {
      return ["down"] as const;
    }

    return [];
  });
}

async function readBranchLabel(cwd: string): Promise<string | null> {
  const branch = await execa("git", ["rev-parse", "--abbrev-ref", "HEAD"], {
    cwd,
    reject: false,
  });

  if (branch.exitCode !== 0) {
    return null;
  }

  const status = await execa("git", ["status", "--porcelain"], {
    cwd,
    reject: false,
  });
  const isDirty = status.exitCode === 0 && status.stdout.trim().length > 0;
  return `${branch.stdout.trim()}${isDirty ? "*" : ""}`;
}

function truncateText(value: string, width: number): string {
  if (visualWidth(value) <= width) {
    return value;
  }

  if (width <= 1) {
    return "…";
  }

  return `${Array.from(value).slice(0, Math.max(0, width - 1)).join("")}…`;
}

function chunkText(value: string, width: number): string[] {
  const characters = Array.from(value);
  const chunks: string[] = [];

  for (let index = 0; index < characters.length; index += width) {
    chunks.push(characters.slice(index, index + width).join(""));
  }

  return chunks.length > 0 ? chunks : [""];
}

function visualWidth(value: string): number {
  return Array.from(value).length;
}
