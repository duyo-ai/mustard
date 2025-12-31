/* API Route: Analyze Images using Gemini Vision */

import { NextRequest, NextResponse } from "next/server";
import { analyzeImagesFromBase64 } from "@/lib/gemini/analyzeImages";

/*
 * Maximum number of images allowed per request.
 * Gemini 2.5 Flash supports up to 50 images per batch request.
 */
const MAX_IMAGES = 50;

/*
 * Maximum size per image in bytes (100MB).
 * Increased to support high-resolution images for better analysis quality.
 */
const MAX_IMAGE_SIZE = 100 * 1024 * 1024;

/*
 * POST /api/analyze-images
 *
 * Analyzes uploaded images using Gemini Vision to extract descriptions
 * for later use in image placement.
 *
 * Request body:
 * - images: Array<{ data: string, mimeType: string }>
 *   - data: base64-encoded image data (without data URL prefix)
 *   - mimeType: e.g., "image/jpeg", "image/png"
 *
 * Response:
 * - descriptions: ImageDescription[]
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { images } = body;

    /*
     * Validate images array.
     * Each image must have 'data' (base64) and 'mimeType'.
     */
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
    for (let i = 0; i < images.length; i++) {
      const img = images[i];

      if (!img.data || typeof img.data !== "string") {
        return NextResponse.json(
          { error: `images[${i}].data must be a base64 string` },
          { status: 400 }
        );
      }

      if (!img.mimeType || typeof img.mimeType !== "string") {
        return NextResponse.json(
          { error: `images[${i}].mimeType is required` },
          { status: 400 }
        );
      }

      /*
       * Validate mime type.
       * Gemini supports common image formats.
       */
      const validMimeTypes = [
        "image/jpeg",
        "image/png",
        "image/webp",
        "image/gif",
      ];
      if (!validMimeTypes.includes(img.mimeType)) {
        return NextResponse.json(
          {
            error: `images[${i}].mimeType must be one of: ${validMimeTypes.join(", ")}`,
          },
          { status: 400 }
        );
      }

      /*
       * Check approximate size from base64 length.
       * Base64 encoding increases size by ~33%, so we estimate original size.
       */
      const estimatedSize = (img.data.length * 3) / 4;
      if (estimatedSize > MAX_IMAGE_SIZE) {
        return NextResponse.json(
          { error: `images[${i}] exceeds maximum size of 100MB` },
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
     * This function handles errors gracefully, returning fallback descriptions
     * for images that fail to analyze.
     * Returns both descriptions and usage metadata for client-side logging.
     */
    const result = await analyzeImagesFromBase64(images, apiKey);

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
