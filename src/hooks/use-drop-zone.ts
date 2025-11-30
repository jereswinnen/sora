"use client";

import { useState, useCallback, useRef } from "react";

interface UseDropZoneOptions {
  onDrop?: (file: File) => void;
  accept?: string;
  disabled?: boolean;
}

/**
 * Hook for handling page-level drag-and-drop
 * Uses a counter to handle drag enter/leave events correctly with nested elements
 */
export function useDropZone(options: UseDropZoneOptions = {}) {
  const { onDrop, accept = "image/*", disabled = false } = options;

  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const dragCounterRef = useRef(0);

  const isAcceptedType = useCallback(
    (file: File): boolean => {
      if (accept === "*") return true;
      const [type, subtype] = accept.split("/");
      if (subtype === "*") {
        return file.type.startsWith(`${type}/`);
      }
      return file.type === accept;
    },
    [accept]
  );

  const handleDragEnter = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      if (disabled) return;

      dragCounterRef.current++;
      if (e.dataTransfer.types.includes("Files")) {
        setIsDraggingOver(true);
      }
    },
    [disabled]
  );

  const handleDragLeave = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      if (disabled) return;

      dragCounterRef.current--;
      if (dragCounterRef.current === 0) {
        setIsDraggingOver(false);
      }
    },
    [disabled]
  );

  const handleDragOver = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
    },
    []
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      dragCounterRef.current = 0;
      setIsDraggingOver(false);

      if (disabled) return;

      const droppedFile = e.dataTransfer.files?.[0];
      if (!droppedFile) return;

      if (!isAcceptedType(droppedFile)) {
        return;
      }

      onDrop?.(droppedFile);
    },
    [disabled, isAcceptedType, onDrop]
  );

  const dropZoneProps = {
    onDragEnter: handleDragEnter,
    onDragLeave: handleDragLeave,
    onDragOver: handleDragOver,
    onDrop: handleDrop,
  };

  return {
    isDraggingOver,
    dropZoneProps,
  };
}
