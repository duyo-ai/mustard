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
 *
 * The actual Duyo API uses "== HOOK ==" style markers (not "---HOOK---").
 * Format:
 *   == HOOK ==
 *   [content]
 *
 *   == BODY ==
 *   [content]
 *
 *   == CTA ==
 *   [content]
 *
 *   response: [user-facing message]
 */
function parseRefinedContent(response: string): {
  parsed: RefineStoryResponse["parsed"];
  userMessage: string;
} {
  const parsed: RefineStoryResponse["parsed"] = {};

  /*
   * Extract sections using "== SECTION ==" format.
   * Each section ends at the next "== " marker or "response:" or end of string.
   */
  const hookMatch = response.match(
    /==\s*HOOK\s*==\s*([\s\S]*?)(?=(?:==\s*(?:BODY|CTA)\s*==|response:|$))/i
  );
  if (hookMatch && hookMatch[1].trim()) {
    parsed.hook = hookMatch[1].trim();
  }

  const bodyMatch = response.match(
    /==\s*BODY\s*==\s*([\s\S]*?)(?=(?:==\s*(?:HOOK|CTA)\s*==|response:|$))/i
  );
  if (bodyMatch && bodyMatch[1].trim()) {
    parsed.body = bodyMatch[1].trim();
  }

  const ctaMatch = response.match(
    /==\s*CTA\s*==\s*([\s\S]*?)(?=(?:==\s*(?:HOOK|BODY)\s*==|response:|$))/i
  );
  if (ctaMatch && ctaMatch[1].trim()) {
    parsed.cta = ctaMatch[1].trim();
  }

  /* Extract user-facing message from "response:" field */
  const responseMatch = response.match(/response:\s*([\s\S]*?)$/i);
  const userMessage = responseMatch ? responseMatch[1].trim() : response;

  return {
    parsed: Object.keys(parsed).length > 0 ? parsed : undefined,
    userMessage,
  };
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
  const rawResponse = await duyoFetch<{ success: boolean; response: string; model_used: string }>(
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

  /* Parse the response to extract structured content and user message */
  const { parsed, userMessage } = parseRefinedContent(rawResponse.response);

  return {
    success: rawResponse.success,
    response: userMessage,
    model_used: rawResponse.model_used,
    parsed,
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
