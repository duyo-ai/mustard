/**
 * HOOK Generation API Route
 *
 * Generates attention-grabbing HOOK content for short-form video intros.
 * Uses direct OpenRouter calls (migrated from yumeta.kr proxy).
 *
 * Model: anthropic/claude-sonnet-4-5-20250929
 */

import { NextResponse } from "next/server";
import {
  callOpenRouter,
  getOpenRouterKey,
  OpenRouterAPIError,
} from "@/lib/llm/openrouter";
import {
  buildGenerateHookRequest,
  parseHookResponse,
  type HookType,
} from "@/lib/prompts";

/* ─────────────────────────────────────────────────────────────────────────────
 * API Types (backwards compatible)
 * ───────────────────────────────────────────────────────────────────────────── */

export interface GenerateHookAPIRequest {
  bodyContent: string;
  hookType?: HookType;
}

export interface GenerateHookAPIResponse {
  success: boolean;
  hooks: Record<string, string>;
  selectedHook?: string;
  model: string;
  usage: {
    inputTokens: number;
    outputTokens: number;
  };
}

/* ─────────────────────────────────────────────────────────────────────────────
 * Route Handler
 * ───────────────────────────────────────────────────────────────────────────── */

export async function POST(request: Request) {
  try {
    const body: GenerateHookAPIRequest = await request.json();

    /* Validate required fields */
    if (!body.bodyContent) {
      return NextResponse.json(
        { error: "bodyContent is required" },
        { status: 400 }
      );
    }

    /* Get API key */
    let apiKey: string;
    try {
      apiKey = getOpenRouterKey();
    } catch {
      return NextResponse.json(
        { error: "OPENROUTER_API_KEY not configured" },
        { status: 500 }
      );
    }

    console.log("[generate-hook] Generating hooks for content length:", body.bodyContent.length);

    /* Build and send request */
    const requestParams = buildGenerateHookRequest({
      bodyContent: body.bodyContent,
      hookType: body.hookType,
    });

    const result = await callOpenRouter(apiKey, requestParams);

    /* Parse response */
    const hooks = parseHookResponse(result.content);

    console.log("[generate-hook] Generated", Object.keys(hooks).length, "hook variations");

    /* Select hook if specific type was requested */
    let selectedHook: string | undefined;
    if (body.hookType && body.hookType !== "auto") {
      // Map English type to Korean label for lookup
      const koreanType: Record<string, string> = {
        question: "질문형",
        shocking: "충격 사실형",
        contrast: "대비형",
        teaser: "스토리 티저형",
        statistic: "통계 강조형",
        action: "행동 유도형",
      };
      selectedHook = hooks[koreanType[body.hookType] || body.hookType];
    }

    const response: GenerateHookAPIResponse = {
      success: true,
      hooks,
      selectedHook,
      model: result.model,
      usage: {
        inputTokens: result.usage.inputTokens,
        outputTokens: result.usage.outputTokens,
      },
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("[generate-hook] Error:", error);

    if (error instanceof OpenRouterAPIError) {
      return NextResponse.json(
        {
          error: "OpenRouter API error",
          details: error.message,
          code: error.errorCode,
        },
        { status: error.statusCode }
      );
    }

    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: "Failed to generate hook", details: message },
      { status: 500 }
    );
  }
}
