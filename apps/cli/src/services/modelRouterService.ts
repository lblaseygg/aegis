import type { ModelProfileName, ModelProfiles, ModelSelectionMode } from "../types/config.js";
import type { ChatBehavior, ChatMode } from "../types/chat.js";

export interface ResolveModelInput {
  prompt: string;
  mode: ChatMode;
  behavior: ChatBehavior;
  manualModel: string;
  selectionMode: ModelSelectionMode;
  modelProfiles: ModelProfiles;
  installedModels: string[];
}

export interface ResolvedModel {
  model: string;
  profile: ModelProfileName | "manual";
  reason: string;
}

export class ModelRouterService {
  resolve(input: ResolveModelInput): ResolvedModel {
    if (input.selectionMode === "manual") {
      return {
        model: selectFallbackModel(input.manualModel, input.installedModels),
        profile: "manual",
        reason: "Manual model selection is enabled.",
      };
    }

    const profile = chooseProfile(input.prompt, input.mode, input.behavior);
    const candidate = input.modelProfiles[profile];

    return {
      model: selectFallbackModel(candidate, input.installedModels, input.manualModel),
      profile,
      reason: describeProfile(profile),
    };
  }
}

export function resolveInstalledModelName(requested: string, installedModels: string[]): string | undefined {
  if (installedModels.includes(requested)) {
    return requested;
  }

  if (!requested.includes(":")) {
    const latestTagged = `${requested}:latest`;
    if (installedModels.includes(latestTagged)) {
      return latestTagged;
    }
  }

  if (requested.endsWith(":latest")) {
    const base = requested.slice(0, -":latest".length);
    if (installedModels.includes(base)) {
      return base;
    }
  }

  return undefined;
}

function chooseProfile(prompt: string, mode: ChatMode, behavior: ChatBehavior): ModelProfileName {
  const normalized = prompt.trim().toLowerCase();

  if (behavior === "review") {
    return "coding_strong";
  }

  if (mode === "docs") {
    return isShortGeneralPrompt(normalized) ? "fast_general" : "long_running";
  }

  if (isCodePrompt(normalized)) {
    if (isSimpleCodingPrompt(normalized)) {
      return "coding_fast";
    }

    if (isComplexCodingPrompt(normalized)) {
      return "coding_strong";
    }

    return "coding_optimized";
  }

  if (isLongRunningPrompt(normalized)) {
    return "long_running";
  }

  return isShortGeneralPrompt(normalized) ? "fast_general" : "long_running";
}

function isCodePrompt(prompt: string): boolean {
  return (
    /`[^`]+`/.test(prompt) ||
    /@[^\s]+\.[a-z0-9]+/.test(prompt) ||
    /\b(src|app|lib|tests?|component|function|class|interface|type|refactor|debug|bug|stack trace|typescript|javascript|python|rust|sql|regex|compile|linter?)\b/.test(prompt) ||
    /\/[\w./-]+/.test(prompt)
  );
}

function isSimpleCodingPrompt(prompt: string): boolean {
  return prompt.length <= 120 && /\b(explain|what is|syntax|example|snippet|regex|function|loop|recursion)\b/.test(prompt);
}

function isComplexCodingPrompt(prompt: string): boolean {
  return (
    prompt.length >= 220 ||
    /\n/.test(prompt) ||
    /\b(review|refactor|architecture|design|debug|fix|investigate|test plan|performance|migration|incident)\b/.test(prompt)
  );
}

function isLongRunningPrompt(prompt: string): boolean {
  return (
    prompt.length >= 180 ||
    /\b(plan|strategy|proposal|report|analyze|compare|tradeoff|investigate|professional|long-running|agent|workflow|architecture|deep dive)\b/.test(
      prompt,
    )
  );
}

function isShortGeneralPrompt(prompt: string): boolean {
  return (
    prompt.length <= 90 &&
    /\b(hello|hi|hey|what is|who is|why is|how does|explain|summarize|define|recursion|help)\b/.test(prompt)
  );
}

function selectFallbackModel(primary: string, installedModels: string[], secondary?: string): string {
  if (installedModels.length === 0) {
    return primary;
  }

  const resolvedPrimary = resolveInstalledModelName(primary, installedModels);
  if (resolvedPrimary) {
    return resolvedPrimary;
  }

  if (secondary) {
    const resolvedSecondary = resolveInstalledModelName(secondary, installedModels);
    if (resolvedSecondary) {
      return resolvedSecondary;
    }
  }

  return installedModels[0] ?? primary;
}

function describeProfile(profile: ModelProfileName): string {
  switch (profile) {
    case "fast_general":
      return "Fast general-answer routing.";
    case "long_running":
      return "Deeper general reasoning and longer-form work.";
    case "coding_optimized":
      return "General coding assistance.";
    case "coding_fast":
      return "Fast path for simple coding questions.";
    case "coding_strong":
      return "Stronger coding and review routing.";
  }
}
