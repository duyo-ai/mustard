/**
 * CTA Generation API Route
 *
 * Generates Call-To-Action content for short-form video endings.
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
  buildGenerateCtaRequest,
  parseCtaResponse,
  type CtaType,
} from "@/lib/prompts";

/* ─────────────────────────────────────────────────────────────────────────────
 * API Types (backwards compatible)
 * ───────────────────────────────────────────────────────────────────────────── */

export interface GenerateCTAAPIRequest {
  bodyContent: string;
  ctaType?: CtaType;
}

export interface GenerateCTAAPIResponse {
  success: boolean;
  ctas: Record<string, string>;
  selectedCTA?: string;
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
    const body: GenerateCTAAPIRequest = await request.json();

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

    console.log("[generate-cta] Generating CTAs for content length:", body.bodyContent.length);

    /* Build and send request */
    const requestParams = buildGenerateCtaRequest({
      bodyContent: body.bodyContent,
      ctaType: body.ctaType,
    });

    const result = await callOpenRouter(apiKey, requestParams);

    /* Parse response */
    const ctas = parseCtaResponse(result.content);

    console.log("[generate-cta] Generated", Object.keys(ctas).length, "CTA variations");

    /* Select CTA if specific type was requested */
    let selectedCTA: string | undefined;
    if (body.ctaType && body.ctaType !== "auto") {
      // Map English type to Korean label for lookup
      const koreanType: Record<string, string> = {
        engagement: "참여 유도형",
        subscribe: "구독/팔로우 유형",
        extend: "확장 시청 유도형",
        convert: "행동 전환형",
        urgent: "즉각 행동 촉구형",
      };
      selectedCTA = ctas[koreanType[body.ctaType] || body.ctaType];
    }

    const response: GenerateCTAAPIResponse = {
      success: true,
      ctas,
      selectedCTA,
      model: result.model,
      usage: {
        inputTokens: result.usage.inputTokens,
        outputTokens: result.usage.outputTokens,
      },
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("[generate-cta] Error:", error);

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
      { error: "Failed to generate CTA", details: message },
      { status: 500 }
    );
  }
}
