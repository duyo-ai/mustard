/* API Route: Analyze Images using Gemini Vision */

import { NextRequest, NextResponse } from "next/server";
import { analyzeImagesFromUrls } from "@/lib/gemini/analyzeImages";

/*
 * Maximum number of images allowed per request.
 * Gemini 2.5 Flash supports up to 50 images per batch request.
 */
const MAX_IMAGES = 50;

/*
 * POST /api/analyze-images
 *
 * Analyzes images using Gemini Vision to extract descriptions
 * for later use in image placement.
 *
 * Request body:
 * - images: Array<{ url: string, mimeType: string }>
 *   - url: Vercel Blob URL or any accessible image URL
 *   - mimeType: e.g., "image/jpeg", "image/png"
 *
 * Response:
 * - descriptions: ImageDescription[]
 * - usage: { model, tokens, cost, latencyMs, itemLogs }
 *
 * Note: Images are fetched server-side from URLs, bypassing the
 * 4.5MB request body limit imposed by Vercel serverless functions.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { images } = body;

    /* Validate images array */
    if (!images || !Array.isArray(images)) {
      return NextResponse.json(
        { error: "images array is required" },
        { status: 400 }
      );
    }

    if (images.length === 0) {
      return NextResponse.json(
        { error: "At least one image is required" },
        { status: 400 }
      );
    }

    if (images.length > MAX_IMAGES) {
      return NextResponse.json(
        { error: `Maximum ${MAX_IMAGES} images allowed per request` },
        { status: 400 }
      );
    }

    /* Validate each image in the array */
    const validMimeTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];

    for (let i = 0; i < images.length; i++) {
      const img = images[i];

      if (!img.url || typeof img.url !== "string") {
        return NextResponse.json(
          { error: `images[${i}].url must be a valid URL string` },
          { status: 400 }
        );
      }

      /* Validate URL format */
      try {
        new URL(img.url);
      } catch {
        return NextResponse.json(
          { error: `images[${i}].url is not a valid URL` },
          { status: 400 }
        );
      }

      if (!img.mimeType || typeof img.mimeType !== "string") {
        return NextResponse.json(
          { error: `images[${i}].mimeType is required` },
          { status: 400 }
        );
      }

      if (!validMimeTypes.includes(img.mimeType)) {
        return NextResponse.json(
          {
            error: `images[${i}].mimeType must be one of: ${validMimeTypes.join(", ")}`,
          },
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
     * Analyze images using Gemini Vision.
     * Images are fetched from URLs server-side, then analyzed.
     * Returns both descriptions and usage metadata for client-side logging.
     */
    const result = await analyzeImagesFromUrls(images, apiKey);

    return NextResponse.json({
      descriptions: result.descriptions,
      usage: result.usage,
    });
  } catch (error) {
    console.error("analyze-images API error:", error);

    const message =
      error instanceof Error ? error.message : "Unknown error occurred";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
