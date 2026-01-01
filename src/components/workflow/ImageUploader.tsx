"use client";

/* ImageUploader - Multi-image upload with Vercel Blob storage */

import { useState, useCallback, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";

/*
 * UploadedImage now uses blobUrl instead of base64.
 * This bypasses Vercel's 4.5MB body size limit by storing images in Blob storage.
 */
export interface UploadedImage {
  id: string;
  file: File;
  preview: string;
  blobUrl: string;
  mimeType: string;
}

interface ImageUploaderProps {
  onImagesChange: (images: UploadedImage[]) => void;
  maxImages?: number;
  maxSizeMB?: number;
}

const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

export function ImageUploader({
  onImagesChange,
  maxImages = 50,
  maxSizeMB = 50,
}: ImageUploaderProps) {
  const [images, setImages] = useState<UploadedImage[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  /*
   * Upload file to Vercel Blob storage.
   * Returns the blob URL for later use in image analysis.
   */
  const uploadToBlob = useCallback(async (file: File): Promise<string> => {
    const formData = new FormData();
    formData.append("file", file);

    const response = await fetch("/api/upload-image", {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error || "Upload failed");
    }

    const data = await response.json();
    return data.url;
  }, []);

  const processFiles = useCallback(
    async (files: FileList | File[]) => {
      setError(null);
      const fileArray = Array.from(files);

      /* Check total count */
      if (images.length + fileArray.length > maxImages) {
        setError(`Maximum ${maxImages} images allowed`);
        return;
      }

      setIsUploading(true);
      const newImages: UploadedImage[] = [];

      for (let i = 0; i < fileArray.length; i++) {
        const file = fileArray[i];
        setUploadProgress(`Uploading ${i + 1}/${fileArray.length}...`);

        /* Validate type */
        if (!ACCEPTED_TYPES.includes(file.type)) {
          setError(`Invalid file type: ${file.name}. Use JPEG, PNG, WebP, or GIF.`);
          continue;
        }

        /* Validate size */
        const sizeMB = file.size / (1024 * 1024);
        if (sizeMB > maxSizeMB) {
          setError(`File too large: ${file.name}. Maximum ${maxSizeMB}MB.`);
          continue;
        }

        try {
          console.log(`[ImageUploader] Uploading ${file.name} (${sizeMB.toFixed(2)}MB) to Blob...`);
          const blobUrl = await uploadToBlob(file);
          console.log(`[ImageUploader] Uploaded to ${blobUrl}`);

          const preview = URL.createObjectURL(file);

          newImages.push({
            id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
            file,
            preview,
            blobUrl,
            mimeType: file.type,
          });
        } catch (err) {
          console.error(`[ImageUploader] Failed to upload ${file.name}:`, err);
          setError(`Failed to upload: ${file.name}`);
        }
      }

      setIsUploading(false);
      setUploadProgress(null);

      if (newImages.length > 0) {
        const updated = [...images, ...newImages];
        setImages(updated);
        onImagesChange(updated);
      }
    },
    [images, maxImages, maxSizeMB, uploadToBlob, onImagesChange]
  );

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files) {
        processFiles(e.target.files);
      }
      /* Reset input so same file can be selected again */
      e.target.value = "";
    },
    [processFiles]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);

      if (e.dataTransfer.files) {
        processFiles(e.dataTransfer.files);
      }
    },
    [processFiles]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const removeImage = useCallback(
    (id: string) => {
      const imageToRemove = images.find((img) => img.id === id);
      if (imageToRemove) {
        URL.revokeObjectURL(imageToRemove.preview);
      }

      const updated = images.filter((img) => img.id !== id);
      setImages(updated);
      onImagesChange(updated);
      setError(null);
    },
    [images, onImagesChange]
  );

  const clearAll = useCallback(() => {
    images.forEach((img) => URL.revokeObjectURL(img.preview));
    setImages([]);
    onImagesChange([]);
    setError(null);
  }, [images, onImagesChange]);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Upload Images</CardTitle>
        <Badge variant="outline">
          {images.length} / {maxImages}
        </Badge>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Drop Zone */}
        <div
          className={`
            border-2 border-dashed rounded-lg p-8 text-center cursor-pointer
            transition-colors duration-200
            ${isDragging ? "border-primary bg-primary/5" : "border-muted-foreground/25 hover:border-primary/50"}
            ${images.length >= maxImages || isUploading ? "opacity-50 cursor-not-allowed" : ""}
          `}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onClick={() => !isUploading && images.length < maxImages && fileInputRef.current?.click()}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept={ACCEPTED_TYPES.join(",")}
            multiple
            onChange={handleFileSelect}
            className="hidden"
            disabled={images.length >= maxImages || isUploading}
          />
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              {uploadProgress
                ? uploadProgress
                : isDragging
                  ? "Drop images here..."
                  : "Click or drag images to upload"}
            </p>
            <p className="text-xs text-muted-foreground">
              JPEG, PNG, WebP, GIF (max {maxSizeMB}MB each)
            </p>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <p className="text-sm text-destructive">{error}</p>
        )}

        {/* Image Previews */}
        {images.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Uploaded Images</span>
              <Button variant="ghost" size="sm" onClick={clearAll} disabled={isUploading}>
                Clear All
              </Button>
            </div>
            <ScrollArea className="h-[200px]">
              <div className="grid grid-cols-4 gap-2">
                {images.map((image, index) => (
                  <div
                    key={image.id}
                    className="relative group aspect-square rounded-md overflow-hidden border"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={image.preview}
                      alt={`Upload ${index + 1}`}
                      className="w-full h-full object-cover"
                    />
                    {/* Index Badge */}
                    <Badge
                      className="absolute top-1 left-1 text-xs"
                      variant="secondary"
                    >
                      {index + 1}
                    </Badge>
                    {/* Remove Button */}
                    <Button
                      variant="destructive"
                      size="sm"
                      className="absolute top-1 right-1 h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={(e) => {
                        e.stopPropagation();
                        removeImage(image.id);
                      }}
                    >
                      X
                    </Button>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
