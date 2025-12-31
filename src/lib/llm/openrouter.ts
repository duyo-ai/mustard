/**
 * OpenRouter API Client
 *
 * A unified client for calling LLM models via OpenRouter.
 * Replaces the previous yumeta.kr proxy approach with direct API calls.
 *
 * Supported models:
 * - anthropic/claude-sonnet-4-5-20250929 (HOOK/CTA generation)
 * - openai/gpt-4o (story refinement)
 * - openai/gpt-4o-mini (character/location extraction)
 * - x-ai/grok-4-fast (scene splitting)
 */

/* ─────────────────────────────────────────────────────────────────────────────
 * Types
 * ───────────────────────────────────────────────────────────────────────────── */

export interface OpenRouterMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface OpenRouterRequest {
  model: string;
  messages: OpenRouterMessage[];
  max_tokens?: number;
  temperature?: number;
  top_p?: number;
  response_format?: { type: "json_object" };
}

export interface OpenRouterResponse {
  id: string;
  choices: Array<{
    message: {
      role: string;
      content: string;
    };
    finish_reason: string;
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  model: string;
}

export interface OpenRouterError {
  error: {
    message: string;
    type: string;
    code?: string;
  };
}

export interface CallOpenRouterParams {
  model: string;
  messages: OpenRouterMessage[];
  maxTokens?: number;
  temperature?: number;
  topP?: number;
  jsonMode?: boolean;
}

export interface CallOpenRouterResult {
  content: string;
  usage: {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
  };
  model: string;
  finishReason: string;
}

/* ─────────────────────────────────────────────────────────────────────────────
 * Constants
 * ───────────────────────────────────────────────────────────────────────────── */

const OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions";

/* Model aliases for convenience */
export const MODELS = {
  CLAUDE_SONNET_4_5: "anthropic/claude-sonnet-4-5-20250929",
  GPT_4O: "openai/gpt-4o",
  GPT_4O_MINI: "openai/gpt-4o-mini",
  GROK_4_FAST: "x-ai/grok-4-fast",
} as const;

/* Default parameters by use case */
export const DEFAULT_PARAMS = {
  hookGeneration: {
    model: MODELS.CLAUDE_SONNET_4_5,
    maxTokens: 2048,
    temperature: 0.8,
  },
  ctaGeneration: {
    model: MODELS.CLAUDE_SONNET_4_5,
    maxTokens: 2048,
    temperature: 0.8,
  },
  storyRefinement: {
    model: MODELS.GPT_4O,
    maxTokens: 4096,
    temperature: 0.7,
  },
  viralContent: {
    model: MODELS.GPT_4O,
    maxTokens: 1024,
    temperature: 0.7,
  },
  sceneSplitting: {
    model: MODELS.GROK_4_FAST,
    maxTokens: 8192,
    temperature: 0.3,
  },
  characterExtraction: {
    model: MODELS.GPT_4O_MINI,
    maxTokens: 2048,
    temperature: 0.5,
  },
  locationExtraction: {
    model: MODELS.GPT_4O_MINI,
    maxTokens: 2048,
    temperature: 0.7,
  },
} as const;

/* ─────────────────────────────────────────────────────────────────────────────
 * Error Classes
 * ───────────────────────────────────────────────────────────────────────────── */

export class OpenRouterAPIError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public errorType?: string,
    public errorCode?: string
  ) {
    super(message);
    this.name = "OpenRouterAPIError";
  }
}

/* ─────────────────────────────────────────────────────────────────────────────
 * Main API Function
 * ───────────────────────────────────────────────────────────────────────────── */

/**
 * Call OpenRouter API with the specified parameters.
 *
 * @param apiKey - OpenRouter API key (from env or passed in)
 * @param params - Request parameters
 * @returns Response with content, usage, and metadata
 * @throws OpenRouterAPIError on API errors
 */
export async function callOpenRouter(
  apiKey: string,
  params: CallOpenRouterParams
): Promise<CallOpenRouterResult> {
  const { model, messages, maxTokens, temperature, topP, jsonMode } = params;

  const requestBody: OpenRouterRequest = {
    model,
    messages,
    max_tokens: maxTokens,
    temperature,
    top_p: topP,
  };

  if (jsonMode) {
    requestBody.response_format = { type: "json_object" };
  }

  const response = await fetch(OPENROUTER_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(requestBody),
  });

  const data = await response.json();

  /* Handle API errors */
  if (!response.ok || data.error) {
    const errorData = data as OpenRouterError;
    throw new OpenRouterAPIError(
      errorData.error?.message || `OpenRouter API error: ${response.status}`,
      response.status,
      errorData.error?.type,
      errorData.error?.code
    );
  }

  const result = data as OpenRouterResponse;

  /* Validate response structure */
  if (!result.choices?.[0]?.message?.content) {
    throw new OpenRouterAPIError(
      "Empty response from OpenRouter API",
      500,
      "empty_response"
    );
  }

  return {
    content: result.choices[0].message.content,
    usage: {
      inputTokens: result.usage?.prompt_tokens ?? 0,
      outputTokens: result.usage?.completion_tokens ?? 0,
      totalTokens: result.usage?.total_tokens ?? 0,
    },
    model: result.model,
    finishReason: result.choices[0].finish_reason,
  };
}

/* ─────────────────────────────────────────────────────────────────────────────
 * Utility Functions
 * ───────────────────────────────────────────────────────────────────────────── */

/**
 * Get OpenRouter API key from environment.
 * @throws Error if not configured
 */
export function getOpenRouterKey(): string {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) {
    throw new Error("OPENROUTER_API_KEY environment variable is not set");
  }
  return key;
}

/**
 * Build a simple message array with system and user messages.
 */
export function buildMessages(
  systemPrompt: string,
  userMessage: string
): OpenRouterMessage[] {
  return [
    { role: "system", content: systemPrompt },
    { role: "user", content: userMessage },
  ];
}

/**
 * Build messages with conversation history.
 */
export function buildMessagesWithHistory(
  systemPrompt: string,
  history: Array<{ role: "user" | "assistant"; content: string }>,
  currentMessage: string
): OpenRouterMessage[] {
  const messages: OpenRouterMessage[] = [
    { role: "system", content: systemPrompt },
  ];

  for (const msg of history) {
    messages.push({ role: msg.role, content: msg.content });
  }

  messages.push({ role: "user", content: currentMessage });

  return messages;
}
