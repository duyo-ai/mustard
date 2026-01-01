/* API Route: Upload Image to Vercel Blob */

import { put } from "@vercel/blob";
import { NextRequest, NextResponse } from "next/server";

/*
 * POST /api/upload-image
 *
 * Uploads an image to Vercel Blob storage.
 * This bypasses the 4.5MB serverless function body limit by uploading
 * directly to Blob storage and returning a URL.
 *
 * Request: FormData with 'file' field
 * Response: { url: string, pathname: string }
 */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json(
        { error: "No file provided" },
        { status: 400 }
      );
    }

    /* Validate file type */
    const validTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];
    if (!validTypes.includes(file.type)) {
      return NextResponse.json(
        { error: `Invalid file type: ${file.type}` },
        { status: 400 }
      );
    }

    /* Upload to Vercel Blob */
    const blob = await put(file.name, file, {
      access: "public",
      addRandomSuffix: true,
    });

    return NextResponse.json({
      url: blob.url,
      pathname: blob.pathname,
    });
  } catch (error) {
    console.error("[upload-image] Error:", error);
    const message = error instanceof Error ? error.message : "Upload failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
