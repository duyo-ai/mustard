"use client";

/* PlacementVisualizer - Visual representation of image placements in story */

/*
 * Improvement Notes:
 * - Previously, only the first statement of each scene was displayed (line-clamp-2).
 *   Now we show all statements with expandable toggle for better scene context.
 * - Added detailed info panel for placed images showing AI's placement reason.
 * - Added image description details (dominantColors, mood, subjects) via modal.
 * - Removed ScrollArea to show full content without nested scrolling.
 */

import { useState, useCallback, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { Phrase, ImagePlacement, ImageDescription } from "@/lib/core/types";
import type { UploadedImage } from "./ImageUploader";

interface PlacementVisualizerProps {
  phrases: Phrase[];
  placements: ImagePlacement[];
  images: UploadedImage[];
  imageDescriptions: ImageDescription[];
  onPlacementChange?: (placements: ImagePlacement[]) => void;
}

export function PlacementVisualizer({
  phrases,
  placements,
  images,
  imageDescriptions,
  onPlacementChange,
}: PlacementVisualizerProps) {
  const [draggedImageIndex, setDraggedImageIndex] = useState<number | null>(null);
  const [hoveredPhraseIndex, setHoveredPhraseIndex] = useState<number | null>(null);
  const [modalImageIndex, setModalImageIndex] = useState<number | null>(null);

  /*
   * Create a map of phrase index to placements for quick lookup.
   */
  const placementsByPhrase = useMemo(() => {
    const map = new Map<number, ImagePlacement[]>();
    placements.forEach((p) => {
      const existing = map.get(p.phraseIndex) || [];
      map.set(p.phraseIndex, [...existing, p]);
    });
    return map;
  }, [placements]);

  /*
   * Get unplaced images (images without a placement).
   */
  const unplacedImageIndices = useMemo(() => {
    const placedIndices = new Set(placements.map((p) => p.imageIndex));
    return images
      .map((_, i) => i)
      .filter((i) => !placedIndices.has(i));
  }, [placements, images]);

  /*
   * Create a map of statement to placement for quick lookup.
   * Key format: "phraseIndex-statementIndex"
   * Only includes statement-level placements.
   */
  const placementsByStatement = useMemo(() => {
    const map = new Map<string, ImagePlacement>();
    placements.forEach((p) => {
      if (p.type === "statement" && p.statementIndices) {
        p.statementIndices.forEach((stmtIdx) => {
          map.set(`${p.phraseIndex}-${stmtIdx}`, p);
        });
      }
    });
    return map;
  }, [placements]);

  /*
   * Get phrase-level placements for a scene (shown in header).
   */
  const getPhraseLevelPlacements = useCallback(
    (phraseIndex: number): ImagePlacement[] => {
      return (placementsByPhrase.get(phraseIndex) || []).filter(
        (p) => p.type === "phrase"
      );
    },
    [placementsByPhrase]
  );

  /*
   * Get statement-level placements for a scene (shown inline).
   */
  const getStatementLevelPlacements = useCallback(
    (phraseIndex: number): ImagePlacement[] => {
      return (placementsByPhrase.get(phraseIndex) || []).filter(
        (p) => p.type === "statement"
      );
    },
    [placementsByPhrase]
  );

  /*
   * Generate a consistent color class for each image.
   * Used to visually connect statements with their images.
   */
  const getImageColor = useCallback((imageIndex: number) => {
    const colors = [
      { border: "border-blue-400", bg: "bg-blue-50", text: "text-blue-600" },
      { border: "border-green-400", bg: "bg-green-50", text: "text-green-600" },
      { border: "border-purple-400", bg: "bg-purple-50", text: "text-purple-600" },
      { border: "border-orange-400", bg: "bg-orange-50", text: "text-orange-600" },
      { border: "border-pink-400", bg: "bg-pink-50", text: "text-pink-600" },
      { border: "border-cyan-400", bg: "bg-cyan-50", text: "text-cyan-600" },
    ];
    return colors[imageIndex % colors.length];
  }, []);

  const handleDragStart = useCallback((imageIndex: number) => {
    setDraggedImageIndex(imageIndex);
  }, []);

  const handleDragEnd = useCallback(() => {
    setDraggedImageIndex(null);
    setHoveredPhraseIndex(null);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, phraseIndex: number) => {
    e.preventDefault();
    setHoveredPhraseIndex(phraseIndex);
  }, []);

  const handleDragLeave = useCallback(() => {
    setHoveredPhraseIndex(null);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent, phraseIndex: number) => {
      e.preventDefault();
      setHoveredPhraseIndex(null);

      if (draggedImageIndex === null) return;

      /*
       * Update placements: remove existing placement for this image,
       * then add new placement to the target phrase.
       */
      const newPlacements = placements.filter(
        (p) => p.imageIndex !== draggedImageIndex
      );

      newPlacements.push({
        imageIndex: draggedImageIndex,
        type: "phrase",
        phraseIndex,
        confidence: 1.0,
        reason: "Manually placed by user",
      });

      onPlacementChange?.(newPlacements);
      setDraggedImageIndex(null);
    },
    [draggedImageIndex, placements, onPlacementChange]
  );

  const removePlacement = useCallback(
    (imageIndex: number) => {
      const newPlacements = placements.filter(
        (p) => p.imageIndex !== imageIndex
      );
      onPlacementChange?.(newPlacements);
    },
    [placements, onPlacementChange]
  );

  const getImagePreview = (imageIndex: number) => {
    return images[imageIndex]?.preview || "";
  };

  const getImageDescription = (imageIndex: number) => {
    return imageDescriptions[imageIndex]?.description || `Image ${imageIndex + 1}`;
  };

  const getFullImageDescription = (imageIndex: number): ImageDescription | null => {
    return imageDescriptions[imageIndex] || null;
  };

  const getPlacementForImage = (imageIndex: number): ImagePlacement | null => {
    return placements.find((p) => p.imageIndex === imageIndex) || null;
  };

  /* Modal data */
  const modalImage = modalImageIndex !== null ? images[modalImageIndex] : null;
  const modalDesc = modalImageIndex !== null ? getFullImageDescription(modalImageIndex) : null;
  const modalPlacement = modalImageIndex !== null ? getPlacementForImage(modalImageIndex) : null;

  if (phrases.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Image Placement</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-center py-8">
            No scenes available. Complete previous steps first.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Left Panel: Available Images */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-base">Available Images</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {images.map((image, index) => {
                const isPlaced = placements.some((p) => p.imageIndex === index);
                const description = getImageDescription(index);

                return (
                  <div
                    key={image.id}
                    draggable={!isPlaced}
                    onDragStart={() => handleDragStart(index)}
                    onDragEnd={handleDragEnd}
                    className={`
                      p-3 rounded-lg border transition-all duration-200
                      ${isPlaced ? "opacity-60" : "cursor-grab hover:bg-muted/50"}
                      ${draggedImageIndex === index ? "opacity-30" : ""}
                    `}
                  >
                    <div className="flex items-start gap-3">
                      {/* Thumbnail */}
                      <div className="w-16 h-16 rounded overflow-hidden flex-shrink-0 border">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={image.preview}
                          alt={`Image ${index + 1}`}
                          className="w-full h-full object-cover"
                        />
                      </div>

                      {/* Basic Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge variant="outline" className="text-xs">
                            {index + 1}
                          </Badge>
                          {isPlaced && (
                            <Badge variant="secondary" className="text-xs">
                              Placed
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground line-clamp-2">
                          {description}
                        </p>
                        <Button
                          variant="link"
                          size="sm"
                          className="h-auto p-0 text-xs mt-1"
                          onClick={() => setModalImageIndex(index)}
                        >
                          View Details
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {unplacedImageIndices.length > 0 && (
              <>
                <Separator className="my-4" />
                <p className="text-xs text-muted-foreground">
                  Drag images to scenes on the right to place them.
                </p>
              </>
            )}
          </CardContent>
        </Card>

        {/* Right Panel: Scene Timeline with Placements */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Scene Timeline</CardTitle>
            <Badge variant="outline">
              {placements.length} / {images.length} placed
            </Badge>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {phrases.map((phrase, phraseIndex) => {
                const phraseLevelPlacements = getPhraseLevelPlacements(phraseIndex);
                const statementLevelPlacements = getStatementLevelPlacements(phraseIndex);
                const isDropTarget = hoveredPhraseIndex === phraseIndex;

                return (
                  <div
                    key={phrase.id}
                    onDragOver={(e) => handleDragOver(e, phraseIndex)}
                    onDragLeave={handleDragLeave}
                    onDrop={(e) => handleDrop(e, phraseIndex)}
                    className={`
                      border rounded-lg overflow-hidden transition-all duration-200
                      ${isDropTarget ? "border-primary bg-primary/5 ring-2 ring-primary/20" : ""}
                    `}
                  >
                    {/* Scene Header with PHRASE-level images */}
                    <div className="flex items-start gap-2 px-3 py-2 bg-muted/50 border-b">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <Badge variant="default">Scene {phraseIndex + 1}</Badge>
                          <span className="text-xs text-muted-foreground">
                            {phrase.statements.length} statements
                          </span>
                        </div>
                      </div>

                      {/* PHRASE-level images in header (scene background) */}
                      {phraseLevelPlacements.length > 0 && (
                        <div className="flex gap-2">
                          {phraseLevelPlacements.map((placement) => (
                            <div
                              key={placement.imageIndex}
                              className="relative group cursor-pointer"
                              onClick={() => setModalImageIndex(placement.imageIndex)}
                            >
                              <div className="w-14 h-14 rounded border-2 border-dashed border-muted-foreground/50 overflow-hidden">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                  src={getImagePreview(placement.imageIndex)}
                                  alt={`Scene background ${placement.imageIndex + 1}`}
                                  className="w-full h-full object-cover"
                                />
                              </div>
                              <Badge
                                className="absolute -top-2 -left-2 text-xs"
                                variant="default"
                              >
                                {placement.imageIndex + 1}
                              </Badge>
                              <Button
                                variant="destructive"
                                size="sm"
                                className="absolute -top-1 -right-1 h-4 w-4 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  removePlacement(placement.imageIndex);
                                }}
                              >
                                X
                              </Button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Statements with inline STATEMENT-level images */}
                    <div>
                      {phrase.statements.map((statement, stmtIdx) => {
                        const stmtPlacement = placementsByStatement.get(
                          `${phraseIndex}-${stmtIdx}`
                        );
                        const colorClasses = stmtPlacement
                          ? getImageColor(stmtPlacement.imageIndex)
                          : null;

                        return (
                          <div key={statement.id}>
                            {/* Statement text row */}
                            <div
                              className={`
                                flex items-start gap-3 px-3 py-2
                                ${stmtPlacement ? `${colorClasses?.bg} border-l-4 ${colorClasses?.border}` : "hover:bg-muted/30"}
                              `}
                            >
                              <span className="text-xs text-muted-foreground/60 w-6 flex-shrink-0 pt-0.5 text-right">
                                {stmtIdx + 1}.
                              </span>
                              <p className="text-sm text-foreground flex-1">
                                {statement.displayText}
                              </p>
                              {stmtPlacement && (
                                <Badge
                                  variant="outline"
                                  className={`text-xs flex-shrink-0 ${colorClasses?.border} ${colorClasses?.text}`}
                                >
                                  IMG {stmtPlacement.imageIndex + 1}
                                </Badge>
                              )}
                            </div>

                            {/* Inline image for STATEMENT-level placement */}
                            {stmtPlacement && (
                              <div
                                className={`
                                  ml-9 mr-3 mb-2 p-2 rounded
                                  border-2 border-dashed ${colorClasses?.border}
                                  ${colorClasses?.bg}
                                `}
                              >
                                <div className="flex items-start gap-3">
                                  <div
                                    className="relative group cursor-pointer flex-shrink-0"
                                    onClick={() => setModalImageIndex(stmtPlacement.imageIndex)}
                                  >
                                    <div className="w-16 h-16 rounded border overflow-hidden">
                                      {/* eslint-disable-next-line @next/next/no-img-element */}
                                      <img
                                        src={getImagePreview(stmtPlacement.imageIndex)}
                                        alt={`Statement image ${stmtPlacement.imageIndex + 1}`}
                                        className="w-full h-full object-cover"
                                      />
                                    </div>
                                    <Badge
                                      className="absolute -top-2 -left-2 text-xs"
                                      variant="default"
                                    >
                                      {stmtPlacement.imageIndex + 1}
                                    </Badge>
                                    <Badge
                                      className="absolute -bottom-2 -left-2 text-xs"
                                      variant="outline"
                                    >
                                      INL
                                    </Badge>
                                    <Badge
                                      className="absolute -bottom-2 -right-2 text-xs"
                                      variant={
                                        stmtPlacement.confidence > 0.7
                                          ? "default"
                                          : stmtPlacement.confidence > 0.4
                                            ? "secondary"
                                            : "outline"
                                      }
                                    >
                                      {Math.round(stmtPlacement.confidence * 100)}%
                                    </Badge>
                                    <Button
                                      variant="destructive"
                                      size="sm"
                                      className="absolute top-0 right-0 h-5 w-5 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        removePlacement(stmtPlacement.imageIndex);
                                      }}
                                    >
                                      X
                                    </Button>
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-xs text-muted-foreground line-clamp-2">
                                      {stmtPlacement.reason}
                                    </p>
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>

                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Image Detail Modal */}
      <Dialog open={modalImageIndex !== null} onOpenChange={(open) => !open && setModalImageIndex(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Image {modalImageIndex !== null ? modalImageIndex + 1 : ""} Details</DialogTitle>
          </DialogHeader>

          {modalImage && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Image Preview */}
              <div className="space-y-4">
                <div className="aspect-square rounded-lg border overflow-hidden bg-muted">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={modalImage.preview}
                    alt={`Image ${modalImageIndex! + 1}`}
                    className="w-full h-full object-contain"
                  />
                </div>
              </div>

              {/* Details */}
              <div className="space-y-4">
                {/* Description */}
                {modalDesc && (
                  <div>
                    <h4 className="text-sm font-medium mb-2">Description</h4>
                    <p className="text-sm text-muted-foreground">
                      {modalDesc.description}
                    </p>
                  </div>
                )}

                {/* Mood */}
                {modalDesc?.mood && (
                  <div>
                    <h4 className="text-sm font-medium mb-2">Mood</h4>
                    <Badge variant="outline">{modalDesc.mood}</Badge>
                  </div>
                )}

                {/* Subjects */}
                {modalDesc?.subjects && modalDesc.subjects.length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium mb-2">Subjects</h4>
                    <div className="flex flex-wrap gap-1">
                      {modalDesc.subjects.map((subj, i) => (
                        <Badge key={i} variant="secondary">
                          {subj}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {/* Dominant Colors */}
                {modalDesc?.dominantColors && modalDesc.dominantColors.length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium mb-2">Dominant Colors</h4>
                    <div className="flex gap-2">
                      {modalDesc.dominantColors.map((color, i) => (
                        <div key={i} className="flex items-center gap-2">
                          <div
                            className="w-6 h-6 rounded border"
                            style={{ backgroundColor: color }}
                          />
                          <span className="text-xs text-muted-foreground">{color}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <Separator />

                {/* Placement Info */}
                {modalPlacement ? (
                  <div className="space-y-3">
                    <h4 className="text-sm font-medium">Placement Info</h4>
                    <div>
                      <span className="text-xs text-muted-foreground">Type:</span>
                      <Badge
                        variant={modalPlacement.type === "phrase" ? "default" : "secondary"}
                        className="ml-2"
                      >
                        {modalPlacement.type === "phrase" ? "Scene Background" : "Inline (Statement)"}
                      </Badge>
                    </div>
                    <div className="flex items-center flex-wrap gap-1">
                      <span className="text-xs text-muted-foreground">Placed in:</span>
                      <Badge variant="default" className="ml-2">
                        Scene {modalPlacement.phraseIndex + 1}
                      </Badge>
                      {modalPlacement.type === "statement" &&
                        modalPlacement.statementIndices &&
                        modalPlacement.statementIndices.length > 0 && (
                          <Badge variant="outline" className="ml-1">
                            Lines: {modalPlacement.statementIndices.map((i) => i + 1).join(", ")}
                          </Badge>
                        )}
                    </div>
                    <div>
                      <span className="text-xs text-muted-foreground">Confidence:</span>
                      <Badge
                        className="ml-2"
                        variant={
                          modalPlacement.confidence > 0.7
                            ? "default"
                            : modalPlacement.confidence > 0.4
                              ? "secondary"
                              : "outline"
                        }
                      >
                        {Math.round(modalPlacement.confidence * 100)}%
                      </Badge>
                    </div>
                    <div>
                      <span className="text-xs text-muted-foreground block mb-1">Reason:</span>
                      <p className="text-sm bg-muted rounded p-2">
                        {modalPlacement.reason}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div>
                    <h4 className="text-sm font-medium mb-2">Placement Info</h4>
                    <p className="text-sm text-muted-foreground italic">
                      Not yet placed in any scene
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
