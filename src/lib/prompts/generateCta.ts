/**
 * CTA (Call To Action) Generation Prompt
 *
 * Generates effective CTAs for short-form content based on the body content.
 * Ported from: docs/duyo_api/generate_cta.php
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

/**
 * CtaType matches the legacy duyo/types.ts for backwards compatibility.
 * Frontend components depend on these exact values.
 */
export type CtaType =
  | "auto"
  | "engagement"  // 참여 유도형
  | "subscribe"   // 구독/팔로우 유형
  | "extend"      // 확장 시청 유도형
  | "convert"     // 행동 전환형
  | "urgent";     // 즉각 행동 촉구형

export interface GenerateCtaInput {
  bodyContent: string;
  ctaType?: CtaType;
}

export interface ParsedCtas {
  [ctaType: string]: string;
}

/* ─────────────────────────────────────────────────────────────────────────────
 * Constants
 * ───────────────────────────────────────────────────────────────────────────── */

const CTA_TYPE_LABELS: Record<CtaType, string> = {
  auto: "자동",
  engagement: "참여 유도형",
  subscribe: "구독/팔로우 유형",
  extend: "확장 시청 유도형",
  convert: "행동 전환형",
  urgent: "즉각 행동 촉구형",
};

/* ─────────────────────────────────────────────────────────────────────────────
 * Prompt Template
 * ───────────────────────────────────────────────────────────────────────────── */

function buildSystemPrompt(bodyContent: string): string {
  const bodySection = bodyContent || "(BODY content not provided)";

  return `You are a professional CTA (Call To Action) writing specialist.
Your goal is to create effective CTAs that drive viewer action based on the user's BODY story.
You must identify the core content of the BODY and create natural, persuasive action-inducing messages.
Your goal is to make viewers want to take immediate action.

- CTA is included at the end of the BODY to wrap up the content.
- Write the CTA as a single, concise and clear sentence.
- Do not use markdown.
- Reflect the tone and atmosphere of the BODY in your writing.
- IMPORTANT: Write the CTA in Korean.

# Body (BODY)
${bodySection}

# CTA Examples by Type

## Engagement Type
- "If this video was helpful, please hit the like button."
- "Share your thoughts in the comments."

## Subscribe/Follow Type
- "If you want to see more stories, subscribe now."
- "Follow so you don't miss new videos."

## Extended Viewing Type
- "An even more shocking story continues in the next video."
- "If you want to see the sequel, hit the subscribe button."

## External Action Type
- "For more information, check the link in my profile."
- "Free trials can be requested at the link in the description."

## FOMO/Urgency Type
- "If you don't apply right now, it might be too late."
- "This opportunity will disappear soon. Participate right now."`;
}

function buildUserMessage(ctaType: CtaType): string {
  const label = CTA_TYPE_LABELS[ctaType];

  if (ctaType === "auto") {
    return "Based on the BODY story above, please write the most suitable closing CTA.";
  }
  return `Based on the BODY story above, please write a ${label} CTA.`;
}

/* ─────────────────────────────────────────────────────────────────────────────
 * Request Builder
 * ───────────────────────────────────────────────────────────────────────────── */

export function buildGenerateCtaRequest(
  input: GenerateCtaInput
): CallOpenRouterParams {
  const { bodyContent, ctaType = "auto" } = input;

  const messages: OpenRouterMessage[] = [
    { role: "system", content: buildSystemPrompt(bodyContent) },
    { role: "user", content: buildUserMessage(ctaType) },
  ];

  return {
    model: MODELS.CLAUDE_SONNET_4_5,
    messages,
    maxTokens: DEFAULT_PARAMS.ctaGeneration.maxTokens,
    temperature: DEFAULT_PARAMS.ctaGeneration.temperature,
  };
}

/* ─────────────────────────────────────────────────────────────────────────────
 * Response Parser
 * ───────────────────────────────────────────────────────────────────────────── */

export function parseCtaResponse(rawResponse: string): ParsedCtas {
  const ctas: ParsedCtas = {};

  // Pattern uses [\s\S] instead of . with s flag for cross-line matching
  const pattern = /== (.*?) ==\s*\n([\s\S]*?)(?=\n\n==|$)/g;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(rawResponse)) !== null) {
    const ctaTypeName = match[1].trim();
    const ctaContent = match[2].trim();
    ctas[ctaTypeName] = ctaContent;
  }

  if (Object.keys(ctas).length === 0) {
    ctas["auto"] = rawResponse.trim();
  }

  return ctas;
}
