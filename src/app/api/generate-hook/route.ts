/**
 * HOOK Generation API Route
 *
 * Generates attention-grabbing HOOK content for short-form video intros.
 * Uses Duyo API (yumeta.kr) to generate multiple HOOK variations.
 */

import { NextResponse } from "next/server";
import { generateHook } from "@/lib/duyo/client";
import type { HookType } from "@/lib/duyo/types";

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

    const openRouterKey = process.env.OPENROUTER_API_KEY;
    if (!openRouterKey) {
      return NextResponse.json(
        { error: "OPENROUTER_API_KEY not configured" },
        { status: 500 }
      );
    }

    console.log("[generate-hook] Generating hooks for content length:", body.bodyContent.length);

    const result = await generateHook(openRouterKey, {
      bodyContent: body.bodyContent,
      hookType: body.hookType,
    });

    console.log("[generate-hook] Generated", Object.keys(result.hooks).length, "hook variations");

    /* Select the first hook as default if hookType was specified */
    let selectedHook: string | undefined;
    if (body.hookType && body.hookType !== "auto") {
      const koreanType = {
        question: "질문형",
        shocking: "충격 사실형",
        contrast: "대비형",
        teaser: "스토리 티저형",
        statistic: "통계 강조형",
        action: "행동 유도형",
      }[body.hookType];
      selectedHook = result.hooks[koreanType];
    }

    const response: GenerateHookAPIResponse = {
      success: true,
      hooks: result.hooks,
      selectedHook,
      model: result.model_used,
      usage: {
        inputTokens: result.token_info.input_tokens,
        outputTokens: result.token_info.output_tokens,
      },
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("[generate-hook] Error:", error);

    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: "Failed to generate hook", details: message },
      { status: 500 }
    );
  }
}
