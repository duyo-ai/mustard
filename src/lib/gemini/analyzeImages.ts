/* Image analysis using Gemini Vision */

import { getVisionModel, GEMINI_MODEL_ID } from "./client";
import { IMAGE_ANALYSIS_PROMPT } from "./prompts/imagePlacement";
import { calculateCost } from "@/lib/llm/pricing";
import type {
  ImageDescription,
  LLMTokens,
  LLMCost,
  LLMUsageLogItem,
} from "@/lib/core/types";

/*
 * Concurrency limit for parallel image analysis.
 * Balances speed vs API rate limits. Gemini allows ~10 concurrent requests.
 */
const CONCURRENCY_LIMIT = 8;

export interface ImageAnalysisResult {
  descriptions: ImageDescription[];
  usage: {
    model: string;
    tokens: LLMTokens;
    cost: LLMCost;
    latencyMs: number;
    itemLogs: LLMUsageLogItem[];
  };
}

interface SingleAnalysisResult {
  description: ImageDescription;
  tokens: LLMTokens;
  latencyMs: number;
  success: boolean;
  error?: string;
}

/**
 * Runs tasks with a concurrency limit.
 * Unlike Promise.all (all at once) or sequential (one at a time),
 * this processes up to `limit` tasks in parallel at any given moment.
 */
async function runWithConcurrency<T, R>(
  items: T[],
  fn: (item: T) => Promise<R>,
  limit: number
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let nextIndex = 0;

  async function worker(): Promise<void> {
    while (nextIndex < items.length) {
      const currentIndex = nextIndex++;
      results[currentIndex] = await fn(items[currentIndex]);
    }
  }

  const workers = Array.from(
    { length: Math.min(limit, items.length) },
    () => worker()
  );

  await Promise.all(workers);
  return results;
}

/**
 * Analyzes images and extracts descriptions for placement purposes.
 * Returns both descriptions and aggregated usage metrics.
 */
export async function analyzeImages(
  imageFiles: File[],
  apiKey: string
): Promise<ImageAnalysisResult> {
  const model = getVisionModel(apiKey);
  const startTime = Date.now();

  const tasks = imageFiles.map((file, index) => ({
    file,
    index,
  }));

  const results = await runWithConcurrency(
    tasks,
    async (task) => analyzeImageFromFile(task.file, task.index, model),
    CONCURRENCY_LIMIT
  );

  return aggregateResults(results, startTime);
}

/**
 * Analyzes images from base64 strings (for server-side usage).
 * Returns both descriptions and aggregated usage metrics.
 */
export async function analyzeImagesFromBase64(
  images: Array<{ data: string; mimeType: string }>,
  apiKey: string
): Promise<ImageAnalysisResult> {
  const model = getVisionModel(apiKey);
  const startTime = Date.now();

  const tasks = images.map((image, index) => ({
    image,
    index,
  }));

  const results = await runWithConcurrency(
    tasks,
    async (task) => analyzeImageFromBase64Single(task.image, task.index, model),
    CONCURRENCY_LIMIT
  );

  return aggregateResults(results, startTime);
}

/**
 * Analyzes images from URLs (e.g., Vercel Blob URLs).
 * Fetches each image, converts to base64, then analyzes.
 * This bypasses the 4.5MB request body limit by fetching images server-side.
 */
export async function analyzeImagesFromUrls(
  images: Array<{ url: string; mimeType: string }>,
  apiKey: string
): Promise<ImageAnalysisResult> {
  const model = getVisionModel(apiKey);
  const startTime = Date.now();

  const tasks = images.map((image, index) => ({
    image,
    index,
  }));

  const results = await runWithConcurrency(
    tasks,
    async (task) => analyzeImageFromUrl(task.image, task.index, model),
    CONCURRENCY_LIMIT
  );

  return aggregateResults(results, startTime);
}

/**
 * Analyzes a single image from URL.
 * Fetches the image, converts to base64, then calls Gemini.
 */
async function analyzeImageFromUrl(
  image: { url: string; mimeType: string },
  index: number,
  model: ReturnType<typeof getVisionModel>
): Promise<SingleAnalysisResult> {
  const startTime = Date.now();

  try {
    /* Fetch image from URL */
    console.log(`[analyzeImages] Fetching image ${index} from ${image.url}`);
    const response = await fetch(image.url);

    if (!response.ok) {
      throw new Error(`Failed to fetch image: ${response.status}`);
    }

    /* Convert to base64 */
    const arrayBuffer = await response.arrayBuffer();
    const base64Data = Buffer.from(arrayBuffer).toString("base64");

    /* Detect mime type from response if not provided */
    const mimeType = image.mimeType || response.headers.get("content-type") || "image/jpeg";

    return await callGeminiForAnalysis(
      base64Data,
      mimeType,
      index,
      model,
      startTime
    );
  } catch (error) {
    const latencyMs = Date.now() - startTime;
    console.error(`Failed to analyze image ${index} from URL:`, error);

    return {
      description: createFallbackDescription(index),
      tokens: { input: 0, output: 0, total: 0 },
      latencyMs,
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Aggregates individual analysis results into a summary with usage data.
 */
function aggregateResults(
  results: SingleAnalysisResult[],
  startTime: number
): ImageAnalysisResult {
  const totalLatencyMs = Date.now() - startTime;

  /* Aggregate tokens */
  let totalInput = 0;
  let totalOutput = 0;

  const itemLogs: LLMUsageLogItem[] = results.map((r, index) => {
    totalInput += r.tokens.input;
    totalOutput += r.tokens.output;

    return {
      index,
      tokens: r.tokens,
      latencyMs: r.latencyMs,
      success: r.success,
      error: r.error,
    };
  });

  const tokens: LLMTokens = {
    input: totalInput,
    output: totalOutput,
    total: totalInput + totalOutput,
  };

  const cost = calculateCost(GEMINI_MODEL_ID, totalInput, totalOutput);

  return {
    descriptions: results.map((r) => r.description),
    usage: {
      model: GEMINI_MODEL_ID,
      tokens,
      cost,
      latencyMs: totalLatencyMs,
      itemLogs,
    },
  };
}

/**
 * Analyzes a single image from File and returns structured description with usage.
 */
async function analyzeImageFromFile(
  file: File,
  index: number,
  model: ReturnType<typeof getVisionModel>
): Promise<SingleAnalysisResult> {
  const startTime = Date.now();

  try {
    const base64Data = await fileToBase64(file);
    const mimeType = file.type || "image/jpeg";

    return await callGeminiForAnalysis(base64Data, mimeType, index, model, startTime);
  } catch (error) {
    const latencyMs = Date.now() - startTime;
    console.error(`Failed to analyze image ${index}:`, error);

    return {
      description: createFallbackDescription(index),
      tokens: { input: 0, output: 0, total: 0 },
      latencyMs,
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Analyzes a single image from base64 data and returns structured description with usage.
 */
async function analyzeImageFromBase64Single(
  image: { data: string; mimeType: string },
  index: number,
  model: ReturnType<typeof getVisionModel>
): Promise<SingleAnalysisResult> {
  const startTime = Date.now();

  try {
    return await callGeminiForAnalysis(
      image.data,
      image.mimeType,
      index,
      model,
      startTime
    );
  } catch (error) {
    const latencyMs = Date.now() - startTime;
    console.error(`Failed to analyze image ${index}:`, error);

    return {
      description: createFallbackDescription(index),
      tokens: { input: 0, output: 0, total: 0 },
      latencyMs,
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Core function that calls Gemini API to analyze an image.
 * Returns description with usage metadata.
 */
async function callGeminiForAnalysis(
  base64Data: string,
  mimeType: string,
  index: number,
  model: ReturnType<typeof getVisionModel>,
  startTime: number
): Promise<SingleAnalysisResult> {
  const result = await model.generateContent({
    contents: [
      {
        role: "user",
        parts: [
          {
            inlineData: {
              mimeType,
              data: base64Data,
            },
          },
          { text: IMAGE_ANALYSIS_PROMPT },
        ],
      },
    ],
    generationConfig: {
      temperature: 0.3,
      maxOutputTokens: 1024,
    },
  });

  const latencyMs = Date.now() - startTime;
  const response = result.response;
  const text = response.text();

  /*
   * Extract usage metadata from Gemini response.
   * Gemini returns usageMetadata with token counts.
   */
  const usageMetadata = response.usageMetadata;
  const inputTokens = usageMetadata?.promptTokenCount ?? 0;
  const outputTokens = usageMetadata?.candidatesTokenCount ?? 0;

  const tokens: LLMTokens = {
    input: inputTokens,
    output: outputTokens,
    total: inputTokens + outputTokens,
  };

  /* Parse JSON response */
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    return {
      description: createFallbackDescription(index),
      tokens,
      latencyMs,
      success: true,
      error: "Failed to parse JSON response",
    };
  }

  const parsed = JSON.parse(jsonMatch[0]);

  return {
    description: {
      index,
      description: parsed.description || "No description available",
      mood: parsed.mood,
      subjects: parsed.subjects,
      dominantColors: parsed.dominantColors,
    },
    tokens,
    latencyMs,
    success: true,
  };
}

/**
 * Creates a fallback description when analysis fails.
 */
function createFallbackDescription(index: number): ImageDescription {
  return {
    index,
    description: `Image ${index + 1}`,
    mood: undefined,
    subjects: [],
    dominantColors: [],
  };
}

/**
 * Converts a File to base64 string (without data URL prefix).
 */
async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.split(",")[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
