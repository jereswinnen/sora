"use client";

import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { toast } from "sonner";

/**
 * Shared hook for article actions (toggle favorite, archive, read, delete, tags)
 * Avoids duplicating the same logic across multiple components
 */
export function useArticleActions() {
  const updateArticle = useMutation(api.articles.updateArticle);
  const deleteArticle = useMutation(api.articles.deleteArticle);
  const addTag = useMutation(api.articles.addTag);
  const removeTag = useMutation(api.articles.removeTag);

  const handleToggleFavorite = async (
    articleId: Id<"articles">,
    isCurrentlyFavorited: boolean
  ) => {
    try {
      await updateArticle({ articleId, favorited: !isCurrentlyFavorited });
      toast.success(
        isCurrentlyFavorited ? "Removed from favorites!" : "Added to favorites!"
      );
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to update article"
      );
    }
  };

  const handleToggleArchive = async (
    articleId: Id<"articles">,
    isCurrentlyArchived: boolean
  ) => {
    try {
      await updateArticle({ articleId, archived: !isCurrentlyArchived });
      toast.success(
        isCurrentlyArchived ? "Article unarchived!" : "Article archived!"
      );
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to update article"
      );
    }
  };

  const handleToggleRead = async (
    articleId: Id<"articles">,
    isCurrentlyRead: boolean
  ) => {
    try {
      if (isCurrentlyRead) {
        await updateArticle({ articleId, readAt: null });
        toast.success("Article marked as unread!");
      } else {
        await updateArticle({ articleId, readAt: Date.now() });
        toast.success("Article marked as read!");
      }
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to update article"
      );
    }
  };

  const handleDelete = async (articleId: Id<"articles">) => {
    try {
      await deleteArticle({ articleId });
      toast.success("Article deleted!");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to delete article"
      );
      throw err;
    }
  };

  const handleAddTags = async (
    articleId: Id<"articles">,
    tags: string[],
    existingTags: string[]
  ) => {
    if (tags.length === 0) return;

    try {
      // Filter out tags that already exist on the article (client-side optimization)
      const newTags = tags.filter(
        (tag) =>
          !existingTags.some(
            (existingTag) => existingTag.toLowerCase() === tag.toLowerCase()
          )
      );

      if (newTags.length === 0) {
        toast.info("All selected tags are already on this article");
        return;
      }

      // Add tags (backend will handle any remaining duplicates gracefully)
      const results = await Promise.all(
        newTags.map((tag) => addTag({ articleId, tag }))
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

  const handleRemoveTag = async (articleId: Id<"articles">, tag: string) => {
    try {
      await removeTag({ articleId, tag });
      toast.success("Tag removed!");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to remove tag");
    }
  };

  const handleCopyLink = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Link copied to clipboard!");
    } catch {
      toast.error("Failed to copy link");
    }
  };

  const handleViewInBrowser = (url: string) => {
    window.open(url, "_blank", "noopener,noreferrer");
  };

  return {
    handleToggleFavorite,
    handleToggleArchive,
    handleToggleRead,
    handleDelete,
    handleAddTags,
    handleRemoveTag,
    handleCopyLink,
    handleViewInBrowser,
  };
}
