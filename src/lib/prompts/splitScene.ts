/**
 * Scene Splitting Prompt
 *
 * Splits a story into individual scenes for short-form content production.
 * Ported from: docs/duyo_api/split_scene.php
 *
 * Model: x-ai/grok-4-fast
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

export interface SplitSceneInput {
  story: string;
}

export interface Scene {
  sceneNumber: number;
  content: string;
}

export interface ParsedScenes {
  scenes: Scene[];
  rawContent: string;
}

/* ─────────────────────────────────────────────────────────────────────────────
 * Prompt Template
 * ───────────────────────────────────────────────────────────────────────────── */

const SYSTEM_PROMPT = `You are a specialist at dividing stories into short scenes.
Please split the given story into scenes according to the rules below.

# Most Important Rule (Must Follow)
Do not change even a single character of the original story!
- Copy and use the original text as-is.
- Only add line breaks, "scene" separators, and dialogue rules.
- Divide scenes so that transitions are natural.

# Output Rules
1. Use "scene" to indicate screen transitions and divide scenes.
2. Each scene should be divided into the smallest units possible, with 2-4 lines of content.
3. Each line should be kept short, around 20 characters.
4. Split long sentences into multiple lines.

# Dialogue Rules
- When splitting long dialogue into multiple lines, close with double quotes and continue on the next line.
- When splitting dialogue, always wrap in double quotes and add duplicate (character) info.
- If no other character's dialogue appears, omit the (character) info.

## Dialogue Format
(Lady)"Hello. I am"
(Lady)"the person living next door."

# Output Format
Output each scene in the following format:

scene 1
(Scene content - 2-4 lines)

scene 2
(Scene content - 2-4 lines)

...`;

/* ─────────────────────────────────────────────────────────────────────────────
 * Request Builder
 * ───────────────────────────────────────────────────────────────────────────── */

export function buildSplitSceneRequest(
  input: SplitSceneInput
): CallOpenRouterParams {
  const { story } = input;

  const userMessage = `Please split the following story into scenes:\n\n${story}`;

  const messages: OpenRouterMessage[] = [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user", content: userMessage },
  ];

  return {
    model: MODELS.GROK_4_FAST,
    messages,
    maxTokens: DEFAULT_PARAMS.sceneSplitting.maxTokens,
    temperature: DEFAULT_PARAMS.sceneSplitting.temperature,
  };
}

/* ─────────────────────────────────────────────────────────────────────────────
 * Response Parser
 * ───────────────────────────────────────────────────────────────────────────── */

/**
 * Format dialogue lines to ensure proper character tagging.
 *
 * Converts multi-line dialogue to proper format with character tags on each line.
 */
function formatDialogueLines(content: string): string {
  const lines = content.split("\n");
  const result: string[] = [];
  let currentCharacter: string | null = null;
  let inDialogue = false;

  for (const line of lines) {
    const trimmedLine = line.trim();

    const dialogueStart = trimmedLine.match(/^\(([^)]+)\)"(.*)$/);
    if (dialogueStart) {
      currentCharacter = dialogueStart[1];
      const dialogueContent = dialogueStart[2];

      if (dialogueContent.endsWith('"')) {
        result.push(trimmedLine);
        currentCharacter = null;
        inDialogue = false;
      } else {
        inDialogue = true;
        result.push(`(${currentCharacter})"${dialogueContent}"`);
      }
    } else if (inDialogue && currentCharacter && trimmedLine !== "") {
      if (trimmedLine.endsWith('"')) {
        const dialogueContent = trimmedLine.slice(0, -1);
        result.push(`(${currentCharacter})"${dialogueContent}"`);
        currentCharacter = null;
        inDialogue = false;
      } else {
        result.push(`(${currentCharacter})"${trimmedLine}"`);
      }
    } else {
      if (trimmedLine === "" && inDialogue) {
        inDialogue = false;
        currentCharacter = null;
      }
      result.push(line);
    }
  }

  return result.join("\n");
}

/**
 * Parse scene splitting response into structured format.
 */
export function parseSplitSceneResponse(rawResponse: string): ParsedScenes {
  const formattedContent = formatDialogueLines(rawResponse);

  const scenes: Scene[] = [];

  const pattern = /scene\s+(\d+)\s*\n([\s\S]*?)(?=scene\s+\d+|$)/gi;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(formattedContent)) !== null) {
    const sceneNumber = parseInt(match[1], 10);
    const content = match[2].trim();

    if (content) {
      scenes.push({
        sceneNumber,
        content,
      });
    }
  }

  return {
    scenes,
    rawContent: formattedContent,
  };
}
