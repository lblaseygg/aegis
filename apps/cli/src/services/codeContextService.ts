import { access, readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";
import { constants } from "node:fs";

import { execa } from "execa";

const IGNORED_SEGMENTS = new Set([
  ".git",
  "node_modules",
  "dist",
  ".venv",
  "coverage",
  "data",
]);

const WORKSPACE_HINT_TERMS = [
  "workspace",
  "repo",
  "repository",
  "project",
  "folder",
  "directory",
  "current folder",
  "current directory",
  "current workspace",
  "scan",
  "file",
  "files",
  "code",
  "codebase",
  "function",
  "class",
  "module",
  "component",
  "implementation",
  "bug",
  "test",
  "refactor",
];

interface FileMatch {
  file: string;
  lines: number[];
}

export class CodeContextService {
  async listFiles(cwd: string, limit = 25): Promise<string[]> {
    try {
      const result = await execa("rg", ["--files", "--hidden", "-g", "!.git", "-g", "!node_modules", "-g", "!dist"], {
        cwd,
      });
      return result.stdout.split("\n").filter(Boolean).slice(0, limit);
    } catch {
      const files: string[] = [];
      await this.walk(cwd, cwd, files, limit);
      return files;
    }
  }

  async buildPrompt(input: {
    cwd: string;
    question: string;
    model: string;
    behavior: "chat" | "review";
    history: Array<{ role: "user" | "assistant"; text: string }>;
  }): Promise<string> {
    const transcript = input.history
      .slice(-6)
      .map((message) => `${message.role === "user" ? "User" : "Assistant"}: ${message.text}`)
      .join("\n\n");

    if (!shouldInspectWorkspace(input.question, input.behavior)) {
      return `You are Aegis, a local chat assistant running in a terminal.

Current working directory:
${input.cwd}

Recent conversation:
${transcript || "No prior conversation."}

User request:
${input.question}

Instructions:
- Answer normally and concisely.
- The current folder is available if the user asks about the workspace, repo, files, or code.
- Do not claim you inspected local files unless the user explicitly asks about them.
- Do not append generic follow-up invitations about the working directory, workspace, or asking for more details unless the user explicitly asks for that.`;
    }

    const files = await this.listFiles(input.cwd, 40);
    const mentionCandidates = input.question.includes("@") ? await this.listFiles(input.cwd, 2000) : files;
    const mentionedFiles = resolveMentionedFiles(input.question, mentionCandidates);
    const relevant = mergeFileMatches(
      mentionedFiles.map((file) => ({ file, lines: [] })),
      await this.findRelevantFiles(input.cwd, input.question),
    );
    const snippets = await Promise.all(relevant.slice(0, 6).map((match) => this.readSnippet(input.cwd, match)));
    const system =
      input.behavior === "review"
        ? "You are reviewing a local codebase. Prioritize bugs, risks, regressions, and missing tests. Be concrete."
        : "You are assisting with a local codebase. The user explicitly asked about the workspace, so answer using the provided file context and be explicit about uncertainty.";

    return `${system}

Workspace root:
${input.cwd}

Top-level file context:
${files.map((file) => `- ${file}`).join("\n") || "- No files detected"}

Relevant file snippets:
${snippets.filter(Boolean).join("\n\n") || "No targeted file snippets matched the current question."}

Recent conversation:
${transcript || "No prior conversation."}

User request:
${input.question}

Instructions:
- If the request is about code behavior, cite the relevant file paths.
- If the available context is insufficient, say so plainly.
- Do not invent files or symbols that are not present in the provided context.
- Do not append generic follow-up invitations about the working directory, workspace, or asking for more details unless the user explicitly asks for that.`;
  }

  private async findRelevantFiles(cwd: string, question: string): Promise<FileMatch[]> {
    const terms = extractTerms(question);
    if (terms.length === 0) {
      return [];
    }

    try {
      const result = await execa("rg", ["-n", "-i", "--hidden", terms.join("|"), cwd], { reject: false });
      if (!result.stdout.trim()) {
        return [];
      }

      const grouped = new Map<string, number[]>();
      for (const line of result.stdout.split("\n")) {
        const [file, lineNumber] = line.split(":", 3);
        if (!file || !lineNumber) {
          continue;
        }

        const relative = path.relative(cwd, file);
        if (!relative || isIgnored(relative)) {
          continue;
        }

        const lines = grouped.get(relative) ?? [];
        lines.push(Number(lineNumber));
        grouped.set(relative, lines);
      }

      return [...grouped.entries()].map(([file, lines]) => ({ file, lines }));
    } catch {
      return [];
    }
  }

  private async readSnippet(cwd: string, match: FileMatch): Promise<string> {
    const absolutePath = path.join(cwd, match.file);
    const content = await readFile(absolutePath, "utf8");
    const allLines = content.split("\n");
    if (match.lines.length === 0) {
      const snippet = allLines
        .slice(0, 12)
        .map((line, index) => `${index + 1}: ${line}`)
        .join("\n");
      return `File: ${match.file}\n${snippet}`;
    }
    const selected = new Set<number>();
    for (const lineNumber of match.lines.slice(0, 3)) {
      for (let index = Math.max(1, lineNumber - 2); index <= Math.min(allLines.length, lineNumber + 2); index += 1) {
        selected.add(index);
      }
    }

    const snippet = [...selected]
      .sort((left, right) => left - right)
      .map((lineNumber) => `${lineNumber}: ${allLines[lineNumber - 1] ?? ""}`)
      .join("\n");

    return `File: ${match.file}\n${snippet}`;
  }

  private async walk(root: string, current: string, files: string[], limit: number): Promise<void> {
    if (files.length >= limit) {
      return;
    }

    const entries = await readdir(current, { withFileTypes: true });
    for (const entry of entries) {
      if (files.length >= limit) {
        return;
      }

      if (IGNORED_SEGMENTS.has(entry.name)) {
        continue;
      }

      const absolute = path.join(current, entry.name);
      const relative = path.relative(root, absolute);
      if (entry.isDirectory()) {
        await this.walk(root, absolute, files, limit);
        continue;
      }

      files.push(relative);
    }
  }
}

function mergeFileMatches(...groups: FileMatch[][]): FileMatch[] {
  const merged = new Map<string, Set<number>>();

  for (const group of groups) {
    for (const match of group) {
      const lines = merged.get(match.file) ?? new Set<number>();
      for (const line of match.lines) {
        lines.add(line);
      }
      merged.set(match.file, lines);
    }
  }

  return [...merged.entries()].map(([file, lines]) => ({
    file,
    lines: [...lines].sort((left, right) => left - right),
  }));
}

function extractTerms(question: string): string[] {
  const terms = question
    .toLowerCase()
    .match(/[a-z0-9_./-]{3,}/g)
    ?.filter((term) => !term.startsWith("@"))
    ?.filter((term) => !["what", "does", "have", "with", "that", "from", "this"].includes(term));
  return [...new Set(terms ?? [])].slice(0, 8);
}

export function resolveMentionedFiles(question: string, files: string[]): string[] {
  const mentions = [...question.matchAll(/@([^\s@]+)/g)]
    .map((match) => match[1]?.trim())
    .filter((value): value is string => Boolean(value));

  if (mentions.length === 0) {
    return [];
  }

  const normalizedFiles = files.map((file) => ({
    file,
    lower: file.toLowerCase(),
    base: path.basename(file).toLowerCase(),
  }));
  const resolved: string[] = [];

  for (const mention of mentions) {
    const normalizedMention = mention.toLowerCase();
    const match =
      normalizedFiles.find((entry) => entry.lower === normalizedMention) ??
      normalizedFiles.find((entry) => entry.lower.endsWith(`/${normalizedMention}`)) ??
      normalizedFiles.find((entry) => entry.base === normalizedMention) ??
      normalizedFiles.find((entry) => entry.lower.includes(normalizedMention));

    if (match && !resolved.includes(match.file)) {
      resolved.push(match.file);
    }
  }

  return resolved;
}

export function shouldInspectWorkspace(question: string, behavior: "chat" | "review"): boolean {
  if (behavior === "review") {
    return true;
  }

  const normalized = question.toLowerCase();
  if (normalized.includes("@")) {
    return true;
  }

  if (/[./][a-z0-9_-]+/i.test(question) || question.includes("/")) {
    return true;
  }

  return WORKSPACE_HINT_TERMS.some((term) => normalized.includes(term));
}

function isIgnored(relativePath: string): boolean {
  return relativePath.split(path.sep).some((segment) => IGNORED_SEGMENTS.has(segment));
}

export async function isWorkspacePath(value: string): Promise<boolean> {
  try {
    const resolved = path.resolve(value);
    await access(resolved, constants.R_OK);
    return (await stat(resolved)).isDirectory();
  } catch {
    return false;
  }
}
