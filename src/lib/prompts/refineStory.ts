/**
 * Story Refinement Prompt
 *
 * Conversational story editing assistant that can modify HOOK, BODY, and CTA sections.
 * Ported from: docs/duyo_api/refine_story.php
 *
 * Model: openai/gpt-4o
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

export interface StoryContent {
  hookContent?: string;
  bodyContent?: string;
  ctaContent?: string;
}

export interface ConversationMessage {
  role: "user" | "assistant";
  content: string;
}

export interface RefineStoryInput {
  message: string;
  storyContent: StoryContent;
  conversationHistory?: ConversationMessage[];
}

export interface ParsedRefinement {
  hook?: string;
  body?: string;
  cta?: string;
  response: string;
}

/* ─────────────────────────────────────────────────────────────────────────────
 * Prompt Template
 * ───────────────────────────────────────────────────────────────────────────── */

/**
 * Build system prompt for story refinement.
 *
 * The prompt includes all current story sections and output format instructions.
 */
function buildSystemPrompt(storyContent: StoryContent): string {
  const { hookContent, bodyContent, ctaContent } = storyContent;

  const hookSection = hookContent || "(Not yet written)";
  const bodySection = bodyContent || "(Not yet written)";
  const ctaSection = ctaContent || "(Not yet written)";

  return `You are a professional story editing assistant.
Your goal is to polish and improve the user's story to make it more engaging and complete.
You will improve or modify the HOOK, BODY, and CTA sections according to the user's requests.

Present only the modified sections using == HOOK, BODY, CTA == separators.
If there are no modifications, return only the response.
For simple questions or advice requests, respond naturally without modifications.

IMPORTANT: Write all content in Korean.

# Current Story Structure

== HOOK ==
${hookSection}

== BODY ==
${bodySection}

== CTA ==
${ctaSection}


# Output Format

== HOOK ==
[Modified HOOK text if there are changes]

== BODY ==
[Modified BODY text if there are changes]

== CTA ==
[Modified CTA text if there are changes]

response: [Short message to return to the user]`;
}

/* ─────────────────────────────────────────────────────────────────────────────
 * Request Builder
 * ───────────────────────────────────────────────────────────────────────────── */

/**
 * Build OpenRouter request parameters for story refinement.
 *
 * Supports conversation history for multi-turn interactions.
 */
export function buildRefineStoryRequest(
  input: RefineStoryInput
): CallOpenRouterParams {
  const { message, storyContent, conversationHistory = [] } = input;

  const messages: OpenRouterMessage[] = [
    { role: "system", content: buildSystemPrompt(storyContent) },
  ];

  // Add conversation history
  for (const msg of conversationHistory) {
    messages.push({
      role: msg.role,
      content: msg.content,
    });
  }

  // Add current user message
  messages.push({ role: "user", content: message });

  return {
    model: MODELS.GPT_4O,
    messages,
    maxTokens: DEFAULT_PARAMS.storyRefinement.maxTokens,
    temperature: DEFAULT_PARAMS.storyRefinement.temperature,
  };
}

/* ─────────────────────────────────────────────────────────────────────────────
 * Response Parser
 * ───────────────────────────────────────────────────────────────────────────── */

/**
 * Parse refinement response into structured format.
 *
 * Extracts modified HOOK, BODY, CTA sections and the response message.
 * Uses == SECTION == format for section markers.
 */
export function parseRefineResponse(rawResponse: string): ParsedRefinement {
  const result: ParsedRefinement = {
    response: "",
  };

  // Extract sections using == SECTION == format
  const hookMatch = rawResponse.match(/== HOOK ==\s*\n([\s\S]*?)(?=\n== |\nresponse:|$)/i);
  const bodyMatch = rawResponse.match(/== BODY ==\s*\n([\s\S]*?)(?=\n== |\nresponse:|$)/i);
  const ctaMatch = rawResponse.match(/== CTA ==\s*\n([\s\S]*?)(?=\n== |\nresponse:|$)/i);
  const responseMatch = rawResponse.match(/response:\s*([\s\S]*?)$/i);

  if (hookMatch) {
    const content = hookMatch[1].trim();
    if (content && !content.includes("Not yet written") && !content.includes("아직 작성되지 않음")) {
      result.hook = content;
    }
  }

  if (bodyMatch) {
    const content = bodyMatch[1].trim();
    if (content && !content.includes("Not yet written") && !content.includes("아직 작성되지 않음")) {
      result.body = content;
    }
  }

  if (ctaMatch) {
    const content = ctaMatch[1].trim();
    if (content && !content.includes("Not yet written") && !content.includes("아직 작성되지 않음")) {
      result.cta = content;
    }
  }

  if (responseMatch) {
    result.response = responseMatch[1].trim();
  } else {
    // If no response marker found, use the whole response (for simple conversation)
    // But only if no sections were found either
    if (!hookMatch && !bodyMatch && !ctaMatch) {
      result.response = rawResponse.trim();
    }
  }

  return result;
}
