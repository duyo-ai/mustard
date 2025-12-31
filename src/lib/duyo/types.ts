/**
 * Duyo API Types
 *
 * Type definitions for the Duyo API integration.
 * Duyo provides AI-powered story generation and editing tools.
 */

/* ─────────────────────────────────────────────────────────────────────────────
 * Common Types
 * ───────────────────────────────────────────────────────────────────────────── */

export interface DuyoTokenInfo {
  input_tokens: number;
  output_tokens: number;
  total_tokens?: number;
}

export interface DuyoErrorResponse {
  error: string;
  message?: string;
  raw_response?: string;
  details?: Record<string, unknown>;
}

/* ─────────────────────────────────────────────────────────────────────────────
 * HOOK Generation
 * ───────────────────────────────────────────────────────────────────────────── */

export type HookType =
  | "auto"
  | "question" // 질문형
  | "shocking" // 충격 사실형
  | "contrast" // 대비형
  | "teaser" // 스토리 티저형
  | "statistic" // 통계 강조형
  | "action"; // 행동 유도형

export const HOOK_TYPE_LABELS: Record<HookType, string> = {
  auto: "자동",
  question: "질문형",
  shocking: "충격 사실형",
  contrast: "대비형",
  teaser: "스토리 티저형",
  statistic: "통계 강조형",
  action: "행동 유도형",
};

/**
 * The Duyo API uses Korean keys internally, but we use English keys in our app.
 * This maps our HookType to the Korean key used by Duyo API.
 */
export const HOOK_TYPE_TO_KOREAN: Record<Exclude<HookType, "auto">, string> = {
  question: "질문형",
  shocking: "충격 사실형",
  contrast: "대비형",
  teaser: "스토리 티저형",
  statistic: "통계 강조형",
  action: "행동 유도형",
};

export interface GenerateHookRequest {
  bodyContent: string;
  hookType?: HookType;
}

export interface GenerateHookResponse {
  success: boolean;
  hooks: Record<string, string>;
  raw_response: string;
  model_used: string;
  token_info: DuyoTokenInfo;
}

/* ─────────────────────────────────────────────────────────────────────────────
 * CTA Generation
 * ───────────────────────────────────────────────────────────────────────────── */

export type CTAType =
  | "auto"
  | "engagement" // 참여 유도형
  | "subscribe" // 구독/팔로우 유형
  | "extend" // 확장 시청 유도형
  | "convert" // 행동 전환형
  | "urgent"; // 즉각 행동 촉구형

export const CTA_TYPE_LABELS: Record<CTAType, string> = {
  auto: "자동",
  engagement: "참여 유도형",
  subscribe: "구독/팔로우 유형",
  extend: "확장 시청 유도형",
  convert: "행동 전환형",
  urgent: "즉각 행동 촉구형",
};

export const CTA_TYPE_TO_KOREAN: Record<Exclude<CTAType, "auto">, string> = {
  engagement: "참여 유도형",
  subscribe: "구독/팔로우 유형",
  extend: "확장 시청 유도형",
  convert: "행동 전환형",
  urgent: "즉각 행동 촉구형",
};

export interface GenerateCTARequest {
  bodyContent: string;
  ctaType?: CTAType;
}

export interface GenerateCTAResponse {
  success: boolean;
  ctas: Record<string, string>;
  raw_response: string;
  model_used: string;
  token_info: DuyoTokenInfo;
}

/* ─────────────────────────────────────────────────────────────────────────────
 * Story Refinement (AI Assistant)
 * ───────────────────────────────────────────────────────────────────────────── */

export interface ConversationMessage {
  role: "user" | "assistant";
  content: string;
}

export interface RefineStoryRequest {
  message: string;
  hookContent: string;
  bodyContent: string;
  ctaContent: string;
  conversationHistory?: ConversationMessage[];
  model?: "claude-4.5" | "claude-4" | "claude-3-7";
}

export interface RefineStoryResponse {
  success: boolean;
  response: string;
  model_used: string;
  /**
   * Parsed content from the response.
   * The AI response contains special markers: ---HOOK---, ---BODY---, ---CTA---
   * These are parsed into this object for easy access.
   */
  parsed?: {
    hook?: string;
    body?: string;
    cta?: string;
  };
}

/* ─────────────────────────────────────────────────────────────────────────────
 * Viral Content Generation
 * ───────────────────────────────────────────────────────────────────────────── */

export interface GenerateViralContentRequest {
  storyContent: string;
}

export interface GenerateViralContentResponse {
  success: boolean;
  description: string;
  hashtags: string;
  model: string;
  raw_content: string;
  token_info: DuyoTokenInfo;
}

/* ─────────────────────────────────────────────────────────────────────────────
 * Character Extraction
 * ───────────────────────────────────────────────────────────────────────────── */

export interface CharacterDetail {
  name: string;
  raw_traits: string;
  mood1: string;
  mood2: string;
  age: string;
  sex: string;
}

export interface ExtractCharactersRequest {
  story: string;
}

export interface ExtractCharactersResponse {
  success: boolean;
  characters: Record<string, string>;
  character_details: CharacterDetail[];
  extracted_names: string[];
  raw_analysis: string;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  model: string;
  timestamp: string;
}

/* ─────────────────────────────────────────────────────────────────────────────
 * Location Extraction
 * ───────────────────────────────────────────────────────────────────────────── */

export interface ProcessedScene {
  location: string;
  scene: string;
  full_text: string;
}

export interface GetLocationRequest {
  scenes: string[];
}

export interface GetLocationResponse {
  success: boolean;
  original_scenes: string[];
  processed_scenes: ProcessedScene[];
  raw_output: string;
  token_info: DuyoTokenInfo;
  model_used: string;
}
