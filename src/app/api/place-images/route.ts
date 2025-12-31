/* API Route: Determine Image Placements in Story */

import { NextRequest, NextResponse } from "next/server";
import { placeImages } from "@/lib/gemini/placeImages";
import type {
  Phrase,
  ImageDescription,
  PlacementContext,
  CharacterInfo,
  LocationInfo,
} from "@/lib/core/types";

/*
 * POST /api/place-images
 *
 * Determines optimal placement for images within the story structure.
 * Uses Gemini to analyze relationships between images and story content.
 *
 * Request body:
 * - phrases: Phrase[] (structured scene data from /api/split-scenes)
 * - imageDescriptions: ImageDescription[] (from /api/analyze-images)
 * - context?: PlacementContext (optional, for enhanced placement)
 *   - characters?: CharacterInfo[] (from /api/extract-characters)
 *   - locations?: LocationInfo[] (from /api/get-location)
 *
 * Response:
 * - placements: ImagePlacement[]
 * - usage: { model, tokens, cost, latencyMs }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { phrases, imageDescriptions, context } = body;

    /* Validate phrases */
    if (!phrases || !Array.isArray(phrases)) {
      return NextResponse.json(
        { error: "phrases array is required" },
        { status: 400 }
      );
    }

    if (phrases.length === 0) {
      return NextResponse.json(
        { error: "At least one phrase is required" },
        { status: 400 }
      );
    }

    /*
     * Validate phrase structure.
     * Each phrase must have id, index, and statements array.
     */
    for (let i = 0; i < phrases.length; i++) {
      const phrase = phrases[i] as Phrase;

      if (!phrase.statements || !Array.isArray(phrase.statements)) {
        return NextResponse.json(
          { error: `phrases[${i}].statements must be an array` },
          { status: 400 }
        );
      }
    }

    /* Validate image descriptions */
    if (!imageDescriptions || !Array.isArray(imageDescriptions)) {
      return NextResponse.json(
        { error: "imageDescriptions array is required" },
        { status: 400 }
      );
    }

    /*
     * Allow empty imageDescriptions - this means no images to place.
     * Return empty placements array.
     */
    if (imageDescriptions.length === 0) {
      return NextResponse.json({ placements: [] });
    }

    /*
     * Validate image description structure.
     * Each description must have index and description string.
     */
    for (let i = 0; i < imageDescriptions.length; i++) {
      const desc = imageDescriptions[i] as ImageDescription;

      if (typeof desc.index !== "number") {
        return NextResponse.json(
          { error: `imageDescriptions[${i}].index must be a number` },
          { status: 400 }
        );
      }

      if (typeof desc.description !== "string") {
        return NextResponse.json(
          { error: `imageDescriptions[${i}].description must be a string` },
          { status: 400 }
        );
      }
    }

    const apiKey = process.env.GOOGLE_AI_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        { error: "GOOGLE_AI_API_KEY not configured" },
        { status: 500 }
      );
    }

    /*
     * Build placement context if provided.
     * Context is optional - when omitted, placeImages uses basic text/image matching.
     * When provided, it enables enhanced matching based on character/location info.
     */
    let placementContext: PlacementContext | undefined;

    if (context) {
      placementContext = {};

      if (context.characters && Array.isArray(context.characters)) {
        placementContext.characters = context.characters as CharacterInfo[];
      }

      if (context.locations && Array.isArray(context.locations)) {
        placementContext.locations = context.locations as LocationInfo[];
      }

      /* Only use context if it has meaningful data */
      if (!placementContext.characters?.length && !placementContext.locations?.length) {
        placementContext = undefined;
      }
    }

    /*
     * Determine image placements using Gemini.
     * The placeImages function handles validation and fallbacks internally.
     * Returns both placements and usage metadata for client-side logging.
     */
    const result = await placeImages(
      phrases as Phrase[],
      imageDescriptions as ImageDescription[],
      apiKey,
      placementContext
    );

    return NextResponse.json({
      placements: result.placements,
      usage: result.usage,
    });
  } catch (error) {
    console.error("place-images API error:", error);

    const message =
      error instanceof Error ? error.message : "Unknown error occurred";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
