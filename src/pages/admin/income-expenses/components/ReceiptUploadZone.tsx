/**
 * Reusable upload zone used inside every I&E edit modal.
 *
 * Supports:
 *  - Click the zone to open the file picker (the <label> wraps the hidden
 *    <input type="file">).
 *  - Drag files from the OS onto the zone ("Not able to drag photos" fix).
 *    We attach the native drag handlers to a wrapper <div>, not the <label>,
 *    because some browsers swallow drop events on <label> elements that wrap
 *    file inputs.
 *  - Shows existing + newly-staged images via <ImagePreview> and a tiny spinner
 *    while the initial image list is loading from the backend.
 *
 * This component intentionally does not know about the surrounding modal; it
 * is driven entirely by the `useImageUpload` hook wired up by the modal.
 */

import React, { useRef, useState } from "react";
import { Upload, Image as ImageIcon } from "lucide-react";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import ImagePreview from "./ImagePreview";
import type { ExistingImage } from "../utils/useImageUpload";

interface ReceiptUploadZoneProps {
  inputId: string;
  imageFiles: File[];
  existingImages: ExistingImage[];
  isLoadingImages: boolean;
  fileInputRef: React.RefObject<HTMLInputElement>;
  onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onFilesDropped: (files: File[]) => void;
  onRemoveNew: (index: number) => void;
  onRemoveExisting: (imageId: string) => void;
  label?: string;
}

export default function ReceiptUploadZone({
  inputId,
  imageFiles,
  existingImages,
  isLoadingImages,
  fileInputRef,
  onFileChange,
  onFilesDropped,
  onRemoveNew,
  onRemoveExisting,
  label = "Receipt Images",
}: ReceiptUploadZoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  // Counter so nested dragenter/dragleave pairs don't flicker the highlight.
  const dragCounter = useRef(0);

  const handleDragEnter = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (!e.dataTransfer?.types?.includes("Files")) return;
    dragCounter.current += 1;
    setIsDragging(true);
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer) e.dataTransfer.dropEffect = "copy";
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current -= 1;
    if (dragCounter.current <= 0) {
      dragCounter.current = 0;
      setIsDragging(false);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current = 0;
    setIsDragging(false);
    const files = Array.from(e.dataTransfer?.files || []);
    if (files.length > 0) onFilesDropped(files);
  };

  return (
    <div>
      <Label className="text-muted-foreground text-xs mb-2 block">{label}</Label>

      <div
        onDragEnter={handleDragEnter}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={cn(
          "relative rounded-lg transition-all",
          isDragging && "ring-2 ring-primary ring-offset-2 ring-offset-background"
        )}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/jpg,image/png,image/gif,image/webp"
          multiple
          onChange={onFileChange}
          className="hidden"
          id={inputId}
        />
        <label
          htmlFor={inputId}
          className={cn(
            "flex flex-col items-center justify-center gap-1 w-full py-4 px-4 border-2 border-dashed rounded-lg transition-all cursor-pointer group",
            isDragging
              ? "border-primary bg-primary/10"
              : "border-primary/50 bg-card/50 hover:border-primary hover:bg-card"
          )}
        >
          <div className="flex items-center gap-2">
            <Upload className="w-5 h-5 text-primary group-hover:scale-110 transition-transform" />
            <span className="text-primary font-medium text-sm">
              {isDragging
                ? "Drop images here"
                : imageFiles.length > 0
                ? `Add More Images (${imageFiles.length} selected)`
                : "Choose Images to Upload"}
            </span>
            <ImageIcon className="w-5 h-5 text-primary/70" />
          </div>
          <span className="text-[11px] text-muted-foreground">
            or drag and drop images here
          </span>
        </label>
      </div>

      <p className="text-xs text-muted-foreground mt-2">
        Supported formats: JPEG, PNG, GIF, WebP (Max 10MB per image)
      </p>

      {(imageFiles.length > 0 || existingImages.length > 0 || isLoadingImages) && (
        <div className="mt-4">
          {isLoadingImages ? (
            <div className="text-center py-4 text-muted-foreground text-sm">Loading images...</div>
          ) : (
            <ImagePreview
              newImages={imageFiles}
              existingImages={existingImages}
              onRemoveNew={onRemoveNew}
              onRemoveExisting={onRemoveExisting}
            />
          )}
        </div>
      )}
    </div>
  );
}
