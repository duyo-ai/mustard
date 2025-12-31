/* Image placement logic using Gemini */

import { GoogleGenerativeAI } from "@google/generative-ai";
import {
  IMAGE_PLACEMENT_SYSTEM_INSTRUCTION,
  buildImagePlacementPrompt,
} from "./prompts/imagePlacement";
import { GEMINI_MODEL_ID } from "./client";
import { calculateCost } from "@/lib/llm/pricing";
import type {
  Phrase,
  ImageDescription,
  ImagePlacement,
  LLMTokens,
  LLMCost,
} from "@/lib/core/types";

/*
 * Improvement Notes:
 * - Added responseMimeType: "application/json" to force JSON-only responses.
 * - Using systemInstruction instead of embedding system prompt in user content.
 * - Added detailed logging for debugging placement failures.
 * - The previous implementation often fell back to even distribution because
 *   Gemini would include markdown or explanatory text around the JSON.
 */

export interface ImagePlacementResult {
  placements: ImagePlacement[];
  usage: {
    model: string;
    tokens: LLMTokens;
    cost: LLMCost;
    latencyMs: number;
    finishReason?: string;
  };
}

/**
 * Determines optimal placement for images within the story structure.
 * Uses Gemini with JSON response mode for reliable structured output.
 * Returns both placements and usage metadata for logging.
 */
export async function placeImages(
  phrases: Phrase[],
  imageDescriptions: ImageDescription[],
  apiKey: string
): Promise<ImagePlacementResult> {
  const emptyUsage = {
    model: GEMINI_MODEL_ID,
    tokens: { input: 0, output: 0, total: 0 },
    cost: { input: 0, output: 0, total: 0, currency: "USD" as const },
    latencyMs: 0,
  };

  if (imageDescriptions.length === 0) {
    return { placements: [], usage: emptyUsage };
  }

  if (phrases.length === 0) {
    console.warn("placeImages: No phrases provided, using fallback");
    return {
      placements: createFallbackPlacements(imageDescriptions, phrases),
      usage: emptyUsage,
    };
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const startTime = Date.now();

  console.log("[placeImages] Starting placement analysis", {
    phraseCount: phrases.length,
    imageCount: imageDescriptions.length,
    totalStatements: phrases.reduce((sum, p) => sum + p.statements.length, 0),
  });

  /*
   * Configure model with JSON response mode.
   * This forces Gemini to output only valid JSON, eliminating parsing issues.
   *
   * maxOutputTokens increased to 16384 to handle large stories (17+ scenes).
   * Previous value of 8192 caused truncation on complex placements.
   */
  const model = genAI.getGenerativeModel({
    model: GEMINI_MODEL_ID,
    systemInstruction: IMAGE_PLACEMENT_SYSTEM_INSTRUCTION,
    generationConfig: {
      temperature: 0.3,
      maxOutputTokens: 16384,
      responseMimeType: "application/json",
    },
  });

  const userPrompt = buildImagePlacementPrompt(phrases, imageDescriptions);
  console.log("[placeImages] Prompt length:", userPrompt.length, "chars");

  try {
    console.log("[placeImages] Calling Gemini API...");
    const result = await model.generateContent(userPrompt);
    const latencyMs = Date.now() - startTime;
    const response = result.response;
    const text = response.text();

    /* Extract usage metadata */
    const usageMetadata = response.usageMetadata;
    const inputTokens = usageMetadata?.promptTokenCount ?? 0;
    const outputTokens = usageMetadata?.candidatesTokenCount ?? 0;

    const tokens: LLMTokens = {
      input: inputTokens,
      output: outputTokens,
      total: inputTokens + outputTokens,
    };

    const cost = calculateCost(GEMINI_MODEL_ID, inputTokens, outputTokens);

    /* Get finish reason if available */
    const finishReason = response.candidates?.[0]?.finishReason;

    const usage = {
      model: GEMINI_MODEL_ID,
      tokens,
      cost,
      latencyMs,
      finishReason,
    };

    /* Log response metadata */
    console.log("[placeImages] Response received", {
      latencyMs,
      finishReason,
      inputTokens,
      outputTokens,
      responseLength: text.length,
    });

    /* Warn if response was truncated */
    if (finishReason === "MAX_TOKENS") {
      console.warn("[placeImages] WARNING: Response truncated due to MAX_TOKENS limit!");
    }

    /* Log raw response for debugging (truncated) */
    console.log("[placeImages] Response preview (first 500 chars):", text.slice(0, 500));

    /* Parse JSON response */
    console.log("[placeImages] Parsing JSON response...");
    let parsed: { placements?: unknown[] };
    try {
      parsed = JSON.parse(text);
      console.log("[placeImages] JSON parsed successfully");
    } catch (parseError) {
      console.error("[placeImages] JSON parse error:", parseError);
      console.error("[placeImages] Response length:", text.length);
      console.error("[placeImages] Last 200 chars:", text.slice(-200));

      /* Attempt to extract JSON from response if it contains extra text */
      console.log("[placeImages] Attempting to extract JSON...");
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          parsed = JSON.parse(jsonMatch[0]);
          console.log("[placeImages] Extracted JSON successfully");
        } catch {
          console.error("[placeImages] Failed to extract valid JSON, using fallback");
          return {
            placements: createFallbackPlacements(imageDescriptions, phrases),
            usage,
          };
        }
      } else {
        console.error("[placeImages] No JSON structure found, using fallback");
        return {
          placements: createFallbackPlacements(imageDescriptions, phrases),
          usage,
        };
      }
    }

    if (!parsed.placements || !Array.isArray(parsed.placements)) {
      console.error("[placeImages] Invalid placements structure:", parsed);
      return {
        placements: createFallbackPlacements(imageDescriptions, phrases),
        usage,
      };
    }

    console.log("[placeImages] Raw placements count:", parsed.placements.length);

    /* Validate and clean up placements */
    let validPlacements = validatePlacements(
      parsed.placements,
      phrases,
      imageDescriptions.length
    );
    console.log("[placeImages] After validation:", validPlacements.length, "placements");

    /* Resolve placement conflicts (1 Phrase = max 1 phrase-scope, 1 Statement = max 1 image) */
    const beforeConflictResolution = validPlacements.length;
    validPlacements = resolvePlacementConflicts(validPlacements, phrases.length);
    console.log("[placeImages] After conflict resolution:", validPlacements.length, "placements", {
      phraseScope: validPlacements.filter((p) => p.type === "phrase").length,
      statementScope: validPlacements.filter((p) => p.type === "statement").length,
    });

    /* Check if we got valid placements for all images */
    if (validPlacements.length === 0) {
      console.warn("[placeImages] No valid placements found, using fallback");
      return {
        placements: createFallbackPlacements(imageDescriptions, phrases),
        usage,
      };
    }

    /* Fill in missing images if some were not placed */
    if (validPlacements.length < imageDescriptions.length) {
      console.warn(
        `[placeImages] Only ${validPlacements.length}/${imageDescriptions.length} images placed, filling gaps`
      );
      const filledPlacements = fillMissingPlacements(validPlacements, imageDescriptions, phrases);
      console.log("[placeImages] After filling gaps:", filledPlacements.length, "placements");
      return {
        placements: filledPlacements,
        usage,
      };
    }

    console.log("[placeImages] Placement complete", {
      total: validPlacements.length,
      phraseScope: validPlacements.filter((p) => p.type === "phrase").length,
      statementScope: validPlacements.filter((p) => p.type === "statement").length,
    });
    return { placements: validPlacements, usage };
  } catch (error) {
    const latencyMs = Date.now() - startTime;
    console.error("[placeImages] API error:", error);

    console.warn("[placeImages] Using fallback placements due to error");
    return {
      placements: createFallbackPlacements(imageDescriptions, phrases),
      usage: {
        model: GEMINI_MODEL_ID,
        tokens: { input: 0, output: 0, total: 0 },
        cost: { input: 0, output: 0, total: 0, currency: "USD" as const },
        latencyMs,
      },
    };
  }
}

/**
 * Validates and cleans up placement data from Gemini response.
 */
function validatePlacements(
  rawPlacements: unknown[],
  phrases: Phrase[],
  imageCount: number
): ImagePlacement[] {
  const placements: ImagePlacement[] = [];
  const usedImageIndices = new Set<number>();

  for (const raw of rawPlacements) {
    if (typeof raw !== "object" || raw === null) {
      console.warn("Invalid placement object:", raw);
      continue;
    }

    const placement = raw as Record<string, unknown>;

    /* Validate imageIndex */
    if (
      typeof placement.imageIndex !== "number" ||
      placement.imageIndex < 0 ||
      placement.imageIndex >= imageCount
    ) {
      console.warn("Invalid imageIndex:", placement.imageIndex);
      continue;
    }

    /* Skip duplicate image placements */
    if (usedImageIndices.has(placement.imageIndex)) {
      console.warn("Duplicate imageIndex:", placement.imageIndex);
      continue;
    }

    /* Validate phraseIndex */
    let phraseIndex = 0;
    if (typeof placement.phraseIndex === "number") {
      phraseIndex = Math.max(0, Math.min(placement.phraseIndex, phrases.length - 1));
    }

    /* Validate type */
    const type = placement.type === "statement" ? "statement" : "phrase";

    /* Build valid placement */
    const validPlacement: ImagePlacement = {
      imageIndex: placement.imageIndex,
      type,
      phraseIndex,
      confidence:
        typeof placement.confidence === "number"
          ? Math.max(0, Math.min(1, placement.confidence))
          : 0.7,
      reason:
        typeof placement.reason === "string" && placement.reason.length > 0
          ? placement.reason
          : "AI 분석 결과에 따른 배치",
    };

    /*
     * Validate and normalize statementIndices for statement-level placements.
     * This ensures statementIndices is always a valid array when type="statement".
     */
    if (type === "statement") {
      const phrase = phrases[phraseIndex];
      const maxStatementIndex = phrase ? phrase.statements.length - 1 : 0;

      if (Array.isArray(placement.statementIndices) && placement.statementIndices.length > 0) {
        validPlacement.statementIndices = (placement.statementIndices as number[])
          .filter((i): i is number => typeof i === "number" && i >= 0)
          .map((i) => Math.min(i, maxStatementIndex))
          .filter((v, i, arr) => arr.indexOf(v) === i) // Remove duplicates
          .sort((a, b) => a - b); // Sort ascending
      }

      /* If no valid statementIndices provided, default to first statement */
      if (!validPlacement.statementIndices || validPlacement.statementIndices.length === 0) {
        validPlacement.statementIndices = [0];
        console.warn(
          `Image ${validPlacement.imageIndex}: type="statement" but no valid statementIndices, defaulting to [0]`
        );
      }
    }

    placements.push(validPlacement);
    usedImageIndices.add(placement.imageIndex);
  }

  return placements;
}

/**
 * Resolves placement conflicts to enforce:
 * - 1 Phrase = max 1 phrase-scope image
 * - 1 Statement = max 1 image
 *
 * Two-phase approach:
 * - Phase 1: Resolve phrase-level conflicts
 * - Phase 2: Resolve statement-level conflicts
 *
 * Losers are reassigned: phrase losers → find another phrase or convert to statement,
 * statement losers → reduce indices or convert to phrase.
 */
function resolvePlacementConflicts(
  placements: ImagePlacement[],
  phraseCount: number
): ImagePlacement[] {
  /* Phase 1: Resolve phrase-level conflicts */
  const afterPhraseResolution = resolvePhraseConflicts(placements, phraseCount);

  /* Phase 2: Resolve statement-level conflicts */
  const afterStatementResolution = resolveStatementConflicts(afterPhraseResolution);

  return afterStatementResolution;
}

/**
 * Phase 1: Resolve phrase-level conflicts.
 * Enforces "1 Phrase = max 1 phrase-scope image".
 *
 * When multiple phrase-scope images target the same phrase:
 * - Higher confidence wins
 * - Loser is reassigned to an unoccupied phrase, or converted to statement-scope
 */
function resolvePhraseConflicts(
  placements: ImagePlacement[],
  phraseCount: number
): ImagePlacement[] {
  /* Map: phraseIndex -> { imageIndex, confidence } */
  const phraseOwners = new Map<number, { imageIndex: number; confidence: number }>();

  /* Collect all phrase-scope placements and determine winners */
  const phrasePlacements = placements.filter((p) => p.type === "phrase");
  const otherPlacements = placements.filter((p) => p.type !== "phrase");

  for (const placement of phrasePlacements) {
    const current = phraseOwners.get(placement.phraseIndex);

    if (!current || placement.confidence > current.confidence) {
      phraseOwners.set(placement.phraseIndex, {
        imageIndex: placement.imageIndex,
        confidence: placement.confidence,
      });
    }
  }

  /* Find which phrases are unoccupied */
  const occupiedPhrases = new Set(phraseOwners.keys());
  const unoccupiedPhrases: number[] = [];
  for (let i = 0; i < phraseCount; i++) {
    if (!occupiedPhrases.has(i)) {
      unoccupiedPhrases.push(i);
    }
  }

  /* Process phrase placements: winners stay, losers get reassigned */
  const resolvedPlacements: ImagePlacement[] = [...otherPlacements];

  for (const placement of phrasePlacements) {
    const owner = phraseOwners.get(placement.phraseIndex);

    if (owner?.imageIndex === placement.imageIndex) {
      /* Winner: keep as-is */
      resolvedPlacements.push(placement);
    } else {
      /* Loser: try to reassign to unoccupied phrase */
      if (unoccupiedPhrases.length > 0) {
        const newPhraseIndex = unoccupiedPhrases.shift()!;
        console.log(
          `Image ${placement.imageIndex} lost phrase ${placement.phraseIndex} conflict, reassigned to phrase ${newPhraseIndex}`
        );
        resolvedPlacements.push({
          ...placement,
          phraseIndex: newPhraseIndex,
          confidence: placement.confidence * 0.9,
          reason: `${placement.reason} (phrase 충돌로 재배치)`,
        });
        /* Mark new phrase as occupied to prevent future conflicts */
        occupiedPhrases.add(newPhraseIndex);
      } else {
        /*
         * No unoccupied phrases available.
         * Convert to statement-scope targeting first statement of original phrase.
         */
        console.warn(
          `Image ${placement.imageIndex} lost phrase conflict, no free phrases, converting to statement-scope`
        );
        resolvedPlacements.push({
          ...placement,
          type: "statement",
          statementIndices: [0],
          confidence: placement.confidence * 0.7,
          reason: `${placement.reason} (phrase 충돌로 statement로 변경)`,
        });
      }
    }
  }

  return resolvedPlacements;
}

/**
 * Phase 2: Resolve statement-level conflicts.
 * Enforces "1 Statement = max 1 image".
 *
 * When multiple images target the same statement:
 * - Higher confidence wins
 * - Loser has that statement removed from statementIndices
 * - If loser loses all statements, convert to phrase-scope
 */
function resolveStatementConflicts(
  placements: ImagePlacement[]
): ImagePlacement[] {
  /* Map: "phraseIndex-statementIndex" -> { imageIndex, confidence } */
  const statementOwners = new Map<string, { imageIndex: number; confidence: number }>();

  /* First pass: determine winners for each statement */
  for (const placement of placements) {
    if (placement.type !== "statement" || !placement.statementIndices) {
      continue;
    }

    for (const stmtIdx of placement.statementIndices) {
      const key = `${placement.phraseIndex}-${stmtIdx}`;
      const current = statementOwners.get(key);

      if (!current || placement.confidence > current.confidence) {
        statementOwners.set(key, {
          imageIndex: placement.imageIndex,
          confidence: placement.confidence,
        });
      }
    }
  }

  /* Second pass: update placements based on winners */
  const resolvedPlacements: ImagePlacement[] = [];

  for (const placement of placements) {
    if (placement.type === "phrase") {
      resolvedPlacements.push(placement);
      continue;
    }

    if (!placement.statementIndices) {
      resolvedPlacements.push(placement);
      continue;
    }

    /* Filter out statements where this image lost */
    const wonStatements = placement.statementIndices.filter((stmtIdx) => {
      const key = `${placement.phraseIndex}-${stmtIdx}`;
      const owner = statementOwners.get(key);
      return owner?.imageIndex === placement.imageIndex;
    });

    if (wonStatements.length === 0) {
      /*
       * Lost all target statements.
       * Convert to phrase-level as fallback.
       * Note: This may create a new phrase conflict, but we've already resolved those.
       * In practice, this is rare and acceptable as a degraded placement.
       */
      console.warn(
        `Image ${placement.imageIndex} lost all statement conflicts, converting to phrase-level`
      );
      resolvedPlacements.push({
        ...placement,
        type: "phrase",
        statementIndices: undefined,
        confidence: placement.confidence * 0.8,
        reason: `${placement.reason} (statement 충돌로 phrase로 변경)`,
      });
    } else if (wonStatements.length < placement.statementIndices.length) {
      console.log(
        `Image ${placement.imageIndex} reduced from statements [${placement.statementIndices}] to [${wonStatements}]`
      );
      resolvedPlacements.push({
        ...placement,
        statementIndices: wonStatements,
      });
    } else {
      resolvedPlacements.push(placement);
    }
  }

  return resolvedPlacements;
}

/**
 * Fills in placements for images that were not placed by AI.
 */
function fillMissingPlacements(
  existingPlacements: ImagePlacement[],
  imageDescriptions: ImageDescription[],
  phrases: Phrase[]
): ImagePlacement[] {
  const placedIndices = new Set(existingPlacements.map((p) => p.imageIndex));
  const result = [...existingPlacements];

  for (let i = 0; i < imageDescriptions.length; i++) {
    if (!placedIndices.has(i)) {
      /* Distribute unplaced images across remaining phrases */
      const usedPhrases = new Set(result.map((p) => p.phraseIndex));
      let targetPhrase = 0;

      /* Find an unused phrase if possible */
      for (let p = 0; p < phrases.length; p++) {
        if (!usedPhrases.has(p)) {
          targetPhrase = p;
          break;
        }
      }

      /* If all phrases used, distribute evenly */
      if (usedPhrases.size >= phrases.length) {
        targetPhrase = Math.floor((i / imageDescriptions.length) * phrases.length);
      }

      result.push({
        imageIndex: i,
        type: "phrase",
        phraseIndex: targetPhrase,
        confidence: 0.5,
        reason: "자동 배치 (AI 분석 보완)",
      });
    }
  }

  return result;
}

/**
 * Creates fallback placements when AI analysis fails.
 * Distributes images evenly across phrases.
 */
function createFallbackPlacements(
  imageDescriptions: ImageDescription[],
  phrases: Phrase[]
): ImagePlacement[] {
  console.log("Creating fallback placements for", imageDescriptions.length, "images");

  if (phrases.length === 0) {
    return imageDescriptions.map((_, i) => ({
      imageIndex: i,
      type: "phrase" as const,
      phraseIndex: 0,
      confidence: 0.3,
      reason: "Fallback: 씬 정보 없음",
    }));
  }

  return imageDescriptions.map((_, i) => {
    /* Distribute images evenly across all phrases */
    const phraseIndex = Math.floor((i / imageDescriptions.length) * phrases.length);

    return {
      imageIndex: i,
      type: "phrase" as const,
      phraseIndex: Math.min(phraseIndex, phrases.length - 1),
      confidence: 0.3,
      reason: "Fallback: 자동 분배",
    };
  });
}
