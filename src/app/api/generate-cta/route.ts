/**
 * CTA Generation API Route
 *
 * Generates Call-To-Action content for short-form video endings.
 * Uses Duyo API (yumeta.kr) to generate multiple CTA variations.
 */

import { NextResponse } from "next/server";
import { generateCTA } from "@/lib/duyo/client";
import type { CTAType } from "@/lib/duyo/types";

export interface GenerateCTAAPIRequest {
  bodyContent: string;
  ctaType?: CTAType;
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

    const openRouterKey = process.env.OPENROUTER_API_KEY;
    if (!openRouterKey) {
      return NextResponse.json(
        { error: "OPENROUTER_API_KEY not configured" },
        { status: 500 }
      );
    }

    console.log("[generate-cta] Generating CTAs for content length:", body.bodyContent.length);

    const result = await generateCTA(openRouterKey, {
      bodyContent: body.bodyContent,
      ctaType: body.ctaType,
    });

    console.log("[generate-cta] Generated", Object.keys(result.ctas).length, "CTA variations");

    /* Select the first CTA as default if ctaType was specified */
    let selectedCTA: string | undefined;
    if (body.ctaType && body.ctaType !== "auto") {
      const koreanType = {
        engagement: "참여 유도형",
        subscribe: "구독/팔로우 유형",
        extend: "확장 시청 유도형",
        convert: "행동 전환형",
        urgent: "즉각 행동 촉구형",
      }[body.ctaType];
      selectedCTA = result.ctas[koreanType];
    }

    const response: GenerateCTAAPIResponse = {
      success: true,
      ctas: result.ctas,
      selectedCTA,
      model: result.model_used,
      usage: {
        inputTokens: result.token_info.input_tokens,
        outputTokens: result.token_info.output_tokens,
      },
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("[generate-cta] Error:", error);

    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: "Failed to generate CTA", details: message },
      { status: 500 }
    );
  }
}
