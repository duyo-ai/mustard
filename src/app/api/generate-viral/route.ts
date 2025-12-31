/**
 * Viral Content Generation API Route
 *
 * Generates SNS-optimized descriptions and hashtags for story content.
 * Uses Duyo API (yumeta.kr) to create engaging social media copy.
 */

import { NextResponse } from "next/server";
import { generateViralContent } from "@/lib/duyo/client";

export interface GenerateViralAPIRequest {
  storyContent: string;
}

export interface GenerateViralAPIResponse {
  success: boolean;
  description: string;
  hashtags: string;
  model: string;
  usage: {
    inputTokens: number;
    outputTokens: number;
  };
}

export async function POST(request: Request) {
  try {
    const body: GenerateViralAPIRequest = await request.json();

    /* Validate required fields */
    if (!body.storyContent) {
      return NextResponse.json(
        { error: "storyContent is required" },
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

    console.log("[generate-viral] Generating viral content for story length:", body.storyContent.length);

    const result = await generateViralContent(openRouterKey, {
      storyContent: body.storyContent,
    });

    console.log("[generate-viral] Generated description length:", result.description.length);
    console.log("[generate-viral] Generated hashtags:", result.hashtags.split(" ").length, "tags");

    const response: GenerateViralAPIResponse = {
      success: true,
      description: result.description,
      hashtags: result.hashtags,
      model: result.model,
      usage: {
        inputTokens: result.token_info.input_tokens,
        outputTokens: result.token_info.output_tokens,
      },
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("[generate-viral] Error:", error);

    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: "Failed to generate viral content", details: message },
      { status: 500 }
    );
  }
}
