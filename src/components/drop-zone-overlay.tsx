"use client";

import { Upload } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";

interface DropZoneOverlayProps {
  isDraggingOver: boolean;
  isUploading: boolean;
  uploadingText?: string;
  dropText?: string;
}

export function DropZoneOverlay({
  isDraggingOver,
  isUploading,
  uploadingText = "Uploading...",
  dropText = "Drop to upload",
}: DropZoneOverlayProps) {
  // Upload in progress overlay
  if (isUploading) {
    return (
      <div className="absolute inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center">
        <div className="flex flex-col items-center gap-2">
          <Spinner className="size-8" />
          <p className="text-muted-foreground">{uploadingText}</p>
        </div>
      </div>
    );
  }

  // Drag overlay with animation
  return (
    <div
      className={cn(
        "absolute inset-0 z-50 flex items-center justify-center pointer-events-none transition-all duration-200 ease-out",
        isDraggingOver
          ? "bg-background/60 backdrop-blur-[2px] opacity-100"
          : "bg-transparent backdrop-blur-0 opacity-0"
      )}
    >
      <div
        className={cn(
          "flex flex-col items-center gap-3 text-muted-foreground transition-all duration-200 ease-out",
          isDraggingOver ? "opacity-100 scale-100" : "opacity-0 scale-95"
        )}
      >
        <Upload className="size-8 animate-pulse" />
        <p className="text-sm">{dropText}</p>
      </div>
    </div>
  );
}
