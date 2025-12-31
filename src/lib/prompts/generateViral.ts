/**
 * Viral Content Generation Prompt
 *
 * Generates SNS descriptions and hashtags for short-form content.
 * Ported from: docs/duyo_api/generate_viral_content.php
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

export interface GenerateViralInput {
  storyContent: string;
}

export interface ParsedViralContent {
  description: string;
  hashtags: string;
}

/* ─────────────────────────────────────────────────────────────────────────────
 * Prompt Template
 * ───────────────────────────────────────────────────────────────────────────── */

/**
 * System prompt for viral content generation.
 */
const SYSTEM_PROMPT = `Generate SNS description and hashtags for short-form content.

# Description
1. Attractive viral phrases that can grab viewers' attention
2. Style suitable for Instagram/YouTube Shorts/TikTok
3. Use emojis appropriately (don't overuse)
4. Include comment-inducing phrases

# Hashtags
1. Generate 15-20 hashtags
2. Only use hashtags related to the short-form content
3. Write hashtags separated by spaces on a single line

# Output Format

[Description 300 characters]

[#hashtag1 #hashtag2 #hashtag3 ...]

IMPORTANT: Write all content in Korean.`;

/* ─────────────────────────────────────────────────────────────────────────────
 * Request Builder
 * ───────────────────────────────────────────────────────────────────────────── */

/**
 * Build OpenRouter request parameters for viral content generation.
 */
export function buildGenerateViralRequest(
  input: GenerateViralInput
): CallOpenRouterParams {
  const { storyContent } = input;

  const messages: OpenRouterMessage[] = [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user", content: storyContent },
  ];

  return {
    model: MODELS.GPT_4O,
    messages,
    maxTokens: DEFAULT_PARAMS.viralContent.maxTokens,
    temperature: DEFAULT_PARAMS.viralContent.temperature,
  };
}

/* ─────────────────────────────────────────────────────────────────────────────
 * Response Parser
 * ───────────────────────────────────────────────────────────────────────────── */

/**
 * Parse viral content response into structured format.
 *
 * Attempts to separate description and hashtags using various patterns.
 */
export function parseViralResponse(rawResponse: string): ParsedViralContent {
  let description = "";
  let hashtags = "";

  // Try [설명] and [해시태그] tags first (Korean markers)
  // Using [\s\S] instead of . with s flag for cross-line matching
  const tagMatch = rawResponse.match(/\[설명\]([\s\S]*?)\[해시태그\]([\s\S]*)/);
  if (tagMatch) {
    description = tagMatch[1].trim();
    hashtags = tagMatch[2].trim();
    return { description, hashtags };
  }

  // Try [Description] and [Hashtags] tags (English markers)
  const engTagMatch = rawResponse.match(/\[Description\]([\s\S]*?)\[Hashtags?\]([\s\S]*)/i);
  if (engTagMatch) {
    description = engTagMatch[1].trim();
    hashtags = engTagMatch[2].trim();
    return { description, hashtags };
  }

  // Fallback: split by line breaks and detect hashtag section
  const lines = rawResponse.split("\n");
  let isHashtag = false;

  for (const line of lines) {
    const trimmedLine = line.trim();
    if (!trimmedLine) continue;

    // Skip section markers
    if (trimmedLine.startsWith("[")) continue;

    // Detect hashtag section start
    if (trimmedLine.startsWith("#") || isHashtag) {
      isHashtag = true;
      hashtags += (hashtags ? " " : "") + trimmedLine;
    } else {
      description += (description ? "\n" : "") + trimmedLine;
    }
  }

  // If parsing failed completely, use entire content as description
  if (!description && !hashtags) {
    description = rawResponse.trim();
  }

  return { description, hashtags };
}
