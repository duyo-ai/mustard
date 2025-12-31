/**
 * Story Refinement API Route
 *
 * Enables AI-powered story editing through chat interaction.
 * Uses Duyo API (yumeta.kr) to refine HOOK, BODY, and CTA content.
 */

import { NextResponse } from "next/server";
import { refineStory } from "@/lib/duyo/client";
import type { ConversationMessage } from "@/lib/duyo/types";

export interface RefineStoryAPIRequest {
  message: string;
  hookContent: string;
  bodyContent: string;
  ctaContent: string;
  conversationHistory?: ConversationMessage[];
  model?: "claude-4.5" | "claude-4" | "claude-3-7";
}

export interface RefineStoryAPIResponse {
  success: boolean;
  response: string;
  model: string;
  parsed?: {
    hook?: string;
    body?: string;
    cta?: string;
  };
}

export async function POST(request: Request) {
  try {
    const body: RefineStoryAPIRequest = await request.json();

    /* Validate required fields */
    if (!body.message) {
      return NextResponse.json(
        { error: "message is required" },
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

    console.log("[refine-story] Processing message:", body.message.slice(0, 50) + "...");
    console.log("[refine-story] Conversation history length:", body.conversationHistory?.length || 0);

    const result = await refineStory(openRouterKey, {
      message: body.message,
      hookContent: body.hookContent || "",
      bodyContent: body.bodyContent || "",
      ctaContent: body.ctaContent || "",
      conversationHistory: body.conversationHistory,
      model: body.model,
    });

    console.log("[refine-story] Response received, parsed sections:",
      result.parsed ? Object.keys(result.parsed).join(", ") : "none"
    );

    const response: RefineStoryAPIResponse = {
      success: true,
      response: result.response,
      model: result.model_used,
      parsed: result.parsed,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("[refine-story] Error:", error);

    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: "Failed to refine story", details: message },
      { status: 500 }
    );
  }
}
