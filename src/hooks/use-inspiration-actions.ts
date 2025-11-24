"use client";

import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { toast } from "sonner";

/**
 * Shared hook for inspiration actions (toggle favorite, delete, update, tags)
 * Follows the same pattern as useArticleActions
 */
export function useInspirationActions() {
  const updateInspiration = useMutation(api.inspirations.updateInspiration);
  const deleteInspiration = useMutation(api.inspirations.deleteInspiration);
  const toggleFavorite = useMutation(api.inspirations.toggleFavorite);
  const addTag = useMutation(api.inspirations.addTag);
  const removeTag = useMutation(api.inspirations.removeTag);

  const handleToggleFavorite = async (
    inspirationId: Id<"inspirations">,
    isCurrentlyFavorited: boolean
  ) => {
    try {
      await toggleFavorite({ inspirationId });
      toast.success(
        isCurrentlyFavorited ? "Removed from favorites!" : "Added to favorites!"
      );
      return { favorited: !isCurrentlyFavorited };
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to update inspiration"
      );
      throw err;
    }
  };

  const handleDelete = async (inspirationId: Id<"inspirations">) => {
    try {
      await deleteInspiration({ inspirationId });
      toast.success("Inspiration deleted!");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to delete inspiration"
      );
      throw err;
    }
  };

  const handleUpdate = async (
    inspirationId: Id<"inspirations">,
    updates: { title?: string; description?: string }
  ) => {
    try {
      await updateInspiration({ inspirationId, ...updates });
      toast.success("Inspiration updated!");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to update inspiration"
      );
      throw err;
    }
  };

  const handleAddTags = async (
    inspirationId: Id<"inspirations">,
    tags: string[],
    existingTags: string[]
  ) => {
    if (tags.length === 0) return [];

    try {
      const newTags = tags.filter(
        (tag) =>
          !existingTags.some(
            (existingTag) => existingTag.toLowerCase() === tag.toLowerCase()
          )
      );

      if (newTags.length === 0) {
        toast.info("All selected tags are already on this inspiration");
        return [];
      }

      await Promise.all(
        newTags.map((tag) => addTag({ inspirationId, tag }))
      );

      toast.success(`${newTags.length} tag${newTags.length > 1 ? "s" : ""} added!`);
      return newTags;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to add tags");
      throw err;
    }
  };

  const handleRemoveTag = async (
    inspirationId: Id<"inspirations">,
    tag: string
  ) => {
    try {
      await removeTag({ inspirationId, tag });
      toast.success("Tag removed!");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to remove tag");
      throw err;
    }
  };

  return {
    handleToggleFavorite,
    handleDelete,
    handleUpdate,
    handleAddTags,
    handleRemoveTag,
  };
}
