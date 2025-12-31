/**
 * Hook Generation Prompt
 *
 * Generates engaging hooks for short-form content based on the body content.
 * Ported from: docs/duyo_api/generate_hook.php
 *
 * Model: anthropic/claude-sonnet-4-5-20250929
 */

import {
  type CallOpenRouterParams,
  type OpenRouterMessage,
  MODELS,
  DEFAULT_PARAMS,
} from "../llm/openrouter";

/* ─────────────────────────────────────────────────────────────────────────────
 * Types
 * ───────────────────────────────────────────────────────────────────────────── */

export type HookType =
  | "auto"
  | "question"
  | "shocking_fact"
  | "contrast"
  | "story_teaser"
  | "statistics"
  | "action_inducing";

export interface GenerateHookInput {
  bodyContent: string;
  hookType?: HookType;
}

export interface ParsedHooks {
  [hookType: string]: string;
}

/* ─────────────────────────────────────────────────────────────────────────────
 * Constants
 * ───────────────────────────────────────────────────────────────────────────── */

const HOOK_TYPE_LABELS: Record<HookType, string> = {
  auto: "자동",
  question: "질문형",
  shocking_fact: "충격 사실형",
  contrast: "대비형",
  story_teaser: "스토리 티저형",
  statistics: "통계 강조형",
  action_inducing: "행동 유도형",
};

/* ─────────────────────────────────────────────────────────────────────────────
 * Prompt Template
 * ───────────────────────────────────────────────────────────────────────────── */

/**
 * Build system prompt for hook generation.
 *
 * The prompt includes the body content directly, following the original PHP pattern.
 * This approach provides better context for the model to understand the content's
 * tone and style when generating hooks.
 */
function buildSystemPrompt(bodyContent: string): string {
  const bodySection = bodyContent || "(BODY content not provided)";

  return `You are a professional content HOOK writing expert.
Your goal is to create powerful hooks that grab viewers' attention based on the user's BODY story.
You must identify the core content of the BODY and create a strong first impression.

- Write the HOOK as a single, concise and powerful sentence.
- Do not use markdown.
- Reflect the tone of the BODY in your writing.
- IMPORTANT: Write the HOOK in Korean.

# Body Story (BODY)
${bodySection}

# HOOK Examples
- Question type: Ask a question to arouse curiosity - "Did you know about XX?"
- Shocking fact type: Hint at a twist or shocking fact - "Actually, most people completely misunderstand XX."
- Contrast type: Create tension by contrasting two things - "XX vs XX, which is more dangerous?"
- Story teaser type: Hint at the story flow like a teaser - "A man who XX eventually ends up XX."
- Statistics type: Use extreme statistics to generate interest - "8 out of 10 people fail because of XX."
- Action inducing type: Guide viewers to take action - "Watch until the end to learn XX."`;
}

/**
 * Build user message based on hook type selection.
 */
function buildUserMessage(hookType: HookType): string {
  const label = HOOK_TYPE_LABELS[hookType];

  if (hookType === "auto") {
    return "Based on the BODY story above, please write the most suitable HOOK.";
  }
  return `Based on the BODY story above, please write a ${label} HOOK.`;
}

/* ─────────────────────────────────────────────────────────────────────────────
 * Request Builder
 * ───────────────────────────────────────────────────────────────────────────── */

/**
 * Build OpenRouter request parameters for hook generation.
 */
export function buildGenerateHookRequest(
  input: GenerateHookInput
): CallOpenRouterParams {
  const { bodyContent, hookType = "auto" } = input;

  const messages: OpenRouterMessage[] = [
    { role: "system", content: buildSystemPrompt(bodyContent) },
    { role: "user", content: buildUserMessage(hookType) },
  ];

  return {
    model: MODELS.CLAUDE_SONNET_4_5,
    messages,
    maxTokens: DEFAULT_PARAMS.hookGeneration.maxTokens,
    temperature: DEFAULT_PARAMS.hookGeneration.temperature,
  };
}

/* ─────────────────────────────────────────────────────────────────────────────
 * Response Parser
 * ───────────────────────────────────────────────────────────────────────────── */

/**
 * Parse hook response into structured format.
 *
 * The AI response may contain multiple hooks in the format:
 * == HOOK_TYPE ==
 * hook content
 *
 * If no structured format is found, returns the raw response.
 */
export function parseHookResponse(rawResponse: string): ParsedHooks {
  const hooks: ParsedHooks = {};

  // Pattern: == HOOK_TYPE ==\ncontent (using [\s\S] instead of . with s flag)
  const pattern = /== (.*?) ==\s*\n([\s\S]*?)(?=\n\n==|$)/g;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(rawResponse)) !== null) {
    const hookTypeName = match[1].trim();
    const hookContent = match[2].trim();
    hooks[hookTypeName] = hookContent;
  }

  // If no structured hooks found, return raw response as "auto"
  if (Object.keys(hooks).length === 0) {
    hooks["auto"] = rawResponse.trim();
  }

  return hooks;
}
