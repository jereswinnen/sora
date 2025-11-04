"use client";

import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { toast } from "sonner";

/**
 * Shared hook for book actions (toggle favorite, status changes, delete, tags)
 * Avoids duplicating the same logic across multiple components
 */
export function useBookActions() {
  const updateBook = useMutation(api.books.updateBook);
  const deleteBook = useMutation(api.books.deleteBook);
  const addTag = useMutation(api.books.addTag);
  const removeTag = useMutation(api.books.removeTag);

  const handleToggleFavorite = async (
    bookId: Id<"books">,
    isCurrentlyFavorited: boolean
  ) => {
    try {
      await updateBook({ bookId, favorited: !isCurrentlyFavorited });
      toast.success(
        isCurrentlyFavorited ? "Removed from favorites!" : "Added to favorites!"
      );
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to update book"
      );
    }
  };

  const handleUpdateStatus = async (
    bookId: Id<"books">,
    status: string
  ) => {
    try {
      await updateBook({ bookId, status });
      const statusLabels: Record<string, string> = {
        not_started: "Not Started",
        reading: "Reading",
        finished: "Finished",
        abandoned: "Abandoned",
      };
      toast.success(`Book marked as ${statusLabels[status] || status}!`);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to update book status"
      );
    }
  };

  const handleDelete = async (bookId: Id<"books">) => {
    try {
      await deleteBook({ bookId });
      toast.success("Book deleted!");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to delete book"
      );
      throw err;
    }
  };

  const handleAddTags = async (
    bookId: Id<"books">,
    tags: string[],
    existingTags: string[]
  ) => {
    if (tags.length === 0) return;

    try {
      // Filter out tags that already exist on the book (client-side optimization)
      const newTags = tags.filter(
        (tag) =>
          !existingTags.some(
            (existingTag) => existingTag.toLowerCase() === tag.toLowerCase()
          )
      );

      if (newTags.length === 0) {
        toast.info("All selected tags are already on this book");
        return;
      }

      // Add tags (backend will handle any remaining duplicates gracefully)
      const results = await Promise.all(
        newTags.map((tag) => addTag({ bookId, tag }))
      );

      // Count how many were actually added
      const addedCount = results.filter((r) => !r.alreadyExists).length;

      if (addedCount > 0) {
        toast.success(`${addedCount} tag${addedCount > 1 ? "s" : ""} added!`);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to add tags");
      throw err; // Re-throw so the dialog knows it failed
    }
  };

  const handleRemoveTag = async (bookId: Id<"books">, tag: string) => {
    try {
      await removeTag({ bookId, tag });
      toast.success("Tag removed!");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to remove tag");
    }
  };

  return {
    handleToggleFavorite,
    handleUpdateStatus,
    handleDelete,
    handleAddTags,
    handleRemoveTag,
  };
}
