/**
 * Duyo API Client
 *
 * A client for interacting with the Duyo API (yumeta.kr/duyo_api).
 * All requests require an OpenRouter API key for LLM operations.
 */

import type {
  GenerateHookRequest,
  GenerateHookResponse,
  GenerateCTARequest,
  GenerateCTAResponse,
  RefineStoryRequest,
  RefineStoryResponse,
  GenerateViralContentRequest,
  GenerateViralContentResponse,
  ExtractCharactersRequest,
  ExtractCharactersResponse,
  GetLocationRequest,
  GetLocationResponse,
  DuyoErrorResponse,
  HookType,
  CTAType,
} from "./types";
import { HOOK_TYPE_TO_KOREAN, CTA_TYPE_TO_KOREAN } from "./types";

const DUYO_BASE_URL = "https://yumeta.kr/duyo_api";

/* ─────────────────────────────────────────────────────────────────────────────
 * Error Handling
 * ───────────────────────────────────────────────────────────────────────────── */

export class DuyoAPIError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public details?: DuyoErrorResponse
  ) {
    super(message);
    this.name = "DuyoAPIError";
  }
}

/* ─────────────────────────────────────────────────────────────────────────────
 * Base Request Handler
 * ───────────────────────────────────────────────────────────────────────────── */

async function duyoFetch<T>(
  endpoint: string,
  openRouterKey: string,
  body: Record<string, unknown>
): Promise<T> {
  const url = `${DUYO_BASE_URL}/${endpoint}`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      _openrouter_key: openRouterKey,
      ...body,
    }),
  });

  const data = await response.json();

  if (!response.ok || data.error) {
    throw new DuyoAPIError(
      data.error || `Duyo API error: ${response.status}`,
      response.status,
      data as DuyoErrorResponse
    );
  }

  return data as T;
}

/* ─────────────────────────────────────────────────────────────────────────────
 * HOOK Generation
 * ───────────────────────────────────────────────────────────────────────────── */

/**
 * Generates HOOK content based on the body content.
 * Returns multiple HOOK variations in different styles.
 *
 * @param openRouterKey - OpenRouter API key
 * @param request - Request containing body content and optional hook type
 * @returns Generated hooks in various styles
 */
export async function generateHook(
  openRouterKey: string,
  request: GenerateHookRequest
): Promise<GenerateHookResponse> {
  const hookType = request.hookType || "auto";
  const koreanHookType =
    hookType === "auto"
      ? "자동"
      : HOOK_TYPE_TO_KOREAN[hookType as Exclude<HookType, "auto">];

  return duyoFetch<GenerateHookResponse>("generate_hook.php", openRouterKey, {
    bodyContent: request.bodyContent,
    hookType: koreanHookType,
  });
}

/* ─────────────────────────────────────────────────────────────────────────────
 * CTA Generation
 * ───────────────────────────────────────────────────────────────────────────── */

/**
 * Generates CTA (Call-To-Action) content based on the body content.
 * Returns multiple CTA variations in different styles.
 *
 * @param openRouterKey - OpenRouter API key
 * @param request - Request containing body content and optional CTA type
 * @returns Generated CTAs in various styles
 */
export async function generateCTA(
  openRouterKey: string,
  request: GenerateCTARequest
): Promise<GenerateCTAResponse> {
  const ctaType = request.ctaType || "auto";
  const koreanCtaType =
    ctaType === "auto"
      ? "자동"
      : CTA_TYPE_TO_KOREAN[ctaType as Exclude<CTAType, "auto">];

  return duyoFetch<GenerateCTAResponse>("generate_cta.php", openRouterKey, {
    bodyContent: request.bodyContent,
    ctaType: koreanCtaType,
  });
}

/* ─────────────────────────────────────────────────────────────────────────────
 * Story Refinement (AI Assistant)
 * ───────────────────────────────────────────────────────────────────────────── */

/**
 * Parses the AI response to extract HOOK, BODY, and CTA content.
 * The AI uses markers like ---HOOK---, ---BODY---, ---CTA--- to delimit sections.
 */
function parseRefinedContent(response: string): RefineStoryResponse["parsed"] {
  const result: RefineStoryResponse["parsed"] = {};

  /* Extract HOOK section */
  const hookMatch = response.match(/---HOOK---\s*([\s\S]*?)\s*---HOOK_END---/);
  if (hookMatch) {
    result.hook = hookMatch[1].trim();
  }

  /* Extract BODY section */
  const bodyMatch = response.match(/---BODY---\s*([\s\S]*?)\s*---BODY_END---/);
  if (bodyMatch) {
    result.body = bodyMatch[1].trim();
  }

  /* Extract CTA section */
  const ctaMatch = response.match(/---CTA---\s*([\s\S]*?)\s*---CTA_END---/);
  if (ctaMatch) {
    result.cta = ctaMatch[1].trim();
  }

  return Object.keys(result).length > 0 ? result : undefined;
}

/**
 * Refines story content through AI chat interaction.
 * Allows iterative editing of HOOK, BODY, and CTA sections.
 *
 * @param openRouterKey - OpenRouter API key
 * @param request - Request containing message and current content
 * @returns AI response with optional parsed content sections
 */
export async function refineStory(
  openRouterKey: string,
  request: RefineStoryRequest
): Promise<RefineStoryResponse> {
  const response = await duyoFetch<RefineStoryResponse>(
    "refine_story.php",
    openRouterKey,
    {
      model: request.model || "claude-4.5",
      message: request.message,
      hookContent: request.hookContent,
      bodyContent: request.bodyContent,
      ctaContent: request.ctaContent,
      conversationHistory: request.conversationHistory || [],
    }
  );

  /* Parse the response to extract structured content if available */
  return {
    ...response,
    parsed: parseRefinedContent(response.response),
  };
}

/* ─────────────────────────────────────────────────────────────────────────────
 * Viral Content Generation
 * ───────────────────────────────────────────────────────────────────────────── */

/**
 * Generates SNS-optimized content including description and hashtags.
 *
 * @param openRouterKey - OpenRouter API key
 * @param request - Request containing the story content
 * @returns Generated description and hashtags for social media
 */
export async function generateViralContent(
  openRouterKey: string,
  request: GenerateViralContentRequest
): Promise<GenerateViralContentResponse> {
  return duyoFetch<GenerateViralContentResponse>(
    "generate_viral_content.php",
    openRouterKey,
    {
      storyContent: request.storyContent,
    }
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
 * Character & Location Extraction (Phase 2)
 * ───────────────────────────────────────────────────────────────────────────── */

/**
 * Extracts character information from a story.
 *
 * @param openRouterKey - OpenRouter API key
 * @param request - Request containing the story text
 * @returns Extracted character details
 */
export async function extractCharacters(
  openRouterKey: string,
  request: ExtractCharactersRequest
): Promise<ExtractCharactersResponse> {
  return duyoFetch<ExtractCharactersResponse>(
    "extract_characters.php",
    openRouterKey,
    {
      story: request.story,
    }
  );
}

/**
 * Extracts location information for each scene.
 *
 * @param openRouterKey - OpenRouter API key
 * @param request - Request containing scene texts
 * @returns Scenes with location annotations
 */
export async function getLocation(
  openRouterKey: string,
  request: GetLocationRequest
): Promise<GetLocationResponse> {
  return duyoFetch<GetLocationResponse>("get_location.php", openRouterKey, {
    scenes: request.scenes,
  });
}
