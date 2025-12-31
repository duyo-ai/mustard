/* Story generation using OpenRouter API with Claude */

import type { SelectedKeywords } from "@/lib/core/types";
import { generateSystemPrompt, generateUserPrompt } from "@/lib/core";

const OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions";
const STORY_MODEL = "anthropic/claude-sonnet-4.5";
 
/**
 * Generates a Korean "sseol" (story) using OpenRouter with Claude Sonnet 4.5.
 *
 * This matches the original yt-shorts-generator-3 approach of using
 * OpenRouter with Claude for story generation.
 */
export async function generateStory(
  keywords: SelectedKeywords,
  apiKey: string
): Promise<string> {
  const isHorror = keywords.mood === "scary";
  const systemPrompt = generateSystemPrompt("keyword", keywords);
  const userPrompt = generateUserPrompt(isHorror, keywords);

  try {
    const response = await fetch(OPENROUTER_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: STORY_MODEL,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 1.0,
        max_tokens: 8192,
      }),
    });

    if (!response.ok) {
      const errorData = await response.text();
      throw new Error(`OpenRouter API error: ${response.status} - ${errorData}`);
    }

    const data = await response.json();
    const text = data.choices?.[0]?.message?.content;

    if (!text) {
      throw new Error("Empty response from OpenRouter");
    }

    return text.trim();
  } catch (error) {
    console.error("Story generation failed:", error);
    throw error;
  }
}
