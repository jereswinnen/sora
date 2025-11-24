"use client";

import { useState, useCallback } from "react";
import { Id } from "../../convex/_generated/dataModel";

interface UseImageUploadOptions {
  maxSizeMB?: number;
  acceptedTypes?: string[];
}

interface UploadResult {
  storageId: Id<"_storage">;
  width: number;
  height: number;
}

/**
 * Hook for handling image file uploads to Convex storage
 * Handles validation, preview generation, dimension extraction, and upload
 */
export function useImageUpload(options: UseImageUploadOptions = {}) {
  const { maxSizeMB = 20, acceptedTypes = ["image/"] } = options;

  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const maxSizeBytes = maxSizeMB * 1024 * 1024;

  const validateFile = useCallback(
    (file: File): string | null => {
      const isAcceptedType = acceptedTypes.some((type) =>
        file.type.startsWith(type)
      );
      if (!isAcceptedType) {
        return `Please select an image file`;
      }
      if (file.size > maxSizeBytes) {
        return `File size must be less than ${maxSizeMB}MB`;
      }
      return null;
    },
    [acceptedTypes, maxSizeBytes, maxSizeMB]
  );

  const getImageDimensions = useCallback(
    (file: File): Promise<{ width: number; height: number }> => {
      return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
          URL.revokeObjectURL(img.src);
          resolve({ width: img.width, height: img.height });
        };
        img.src = URL.createObjectURL(file);
      });
    },
    []
  );

  const createPreview = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      setPreview(event.target?.result as string);
    };
    reader.readAsDataURL(file);
  }, []);

  const selectFile = useCallback(
    (selectedFile: File): boolean => {
      const validationError = validateFile(selectedFile);
      if (validationError) {
        setError(validationError);
        return false;
      }

      setFile(selectedFile);
      setError(null);
      createPreview(selectedFile);
      return true;
    },
    [validateFile, createPreview]
  );

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const selectedFile = e.target.files?.[0];
      if (selectedFile) {
        selectFile(selectedFile);
      }
    },
    [selectFile]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent): File | null => {
      e.preventDefault();
      const droppedFile = e.dataTransfer.files?.[0];
      if (droppedFile && selectFile(droppedFile)) {
        return droppedFile;
      }
      return null;
    },
    [selectFile]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
  }, []);

  const upload = useCallback(
    async (
      generateUploadUrl: () => Promise<string>,
      fileToUpload?: File
    ): Promise<UploadResult> => {
      const uploadFile = fileToUpload || file;
      if (!uploadFile) {
        throw new Error("No file selected");
      }

      setIsUploading(true);
      setError(null);

      try {
        const dimensions = await getImageDimensions(uploadFile);
        const uploadUrl = await generateUploadUrl();

        const response = await fetch(uploadUrl, {
          method: "POST",
          headers: { "Content-Type": uploadFile.type },
          body: uploadFile,
        });

        if (!response.ok) {
          throw new Error("Failed to upload file");
        }

        const { storageId } = await response.json();

        return {
          storageId,
          width: dimensions.width,
          height: dimensions.height,
        };
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Failed to upload file";
        setError(message);
        throw err;
      } finally {
        setIsUploading(false);
      }
    },
    [file, getImageDimensions]
  );

  const reset = useCallback(() => {
    setFile(null);
    setPreview(null);
    setError(null);
    setIsUploading(false);
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    file,
    preview,
    isUploading,
    error,
    selectFile,
    handleFileChange,
    handleDrop,
    handleDragOver,
    upload,
    reset,
    clearError,
    validateFile,
  };
}
