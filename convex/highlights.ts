import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

/**
 * Save or update highlights for a piece of content (article or book)
 *
 * If highlights already exist for this user+content, updates them.
 * Otherwise, creates a new highlights record.
 */
export const saveHighlights = mutation({
  args: {
    contentType: v.union(v.literal("article"), v.literal("book")),
    contentId: v.string(),
    serializedData: v.string(),
    color: v.string(),
  },
  handler: async (ctx, args) => {
    // Get authenticated user ID from Auth0
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }
    const userId = identity.subject;

    // Check if highlights already exist for this user+content
    const existing = await ctx.db
      .query("highlights")
      .withIndex("by_user_and_content", (q) =>
        q
          .eq("userId", userId)
          .eq("contentType", args.contentType)
          .eq("contentId", args.contentId)
      )
      .first();

    const now = Date.now();

    if (existing) {
      // Update existing highlights
      await ctx.db.patch(existing._id, {
        serializedData: args.serializedData,
        color: args.color,
        updatedAt: now,
      });
      return existing._id;
    } else {
      // Create new highlights record
      const highlightId = await ctx.db.insert("highlights", {
        userId,
        contentType: args.contentType,
        contentId: args.contentId,
        serializedData: args.serializedData,
        color: args.color,
        createdAt: now,
        updatedAt: now,
      });
      return highlightId;
    }
  },
});

/**
 * Get highlights for a specific piece of content
 *
 * Returns the highlights record if it exists, or null if not found.
 */
export const getHighlights = query({
  args: {
    contentType: v.union(v.literal("article"), v.literal("book")),
    contentId: v.string(),
  },
  handler: async (ctx, args) => {
    // Get authenticated user ID from Auth0
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return null;
    }
    const userId = identity.subject;

    const highlights = await ctx.db
      .query("highlights")
      .withIndex("by_user_and_content", (q) =>
        q
          .eq("userId", userId)
          .eq("contentType", args.contentType)
          .eq("contentId", args.contentId)
      )
      .first();

    return highlights;
  },
});

/**
 * Delete highlights for a specific piece of content
 *
 * Used when user wants to clear all highlights from an article/book.
 */
export const deleteHighlights = mutation({
  args: {
    contentType: v.union(v.literal("article"), v.literal("book")),
    contentId: v.string(),
  },
  handler: async (ctx, args) => {
    // Get authenticated user ID from Auth0
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }
    const userId = identity.subject;

    const highlights = await ctx.db
      .query("highlights")
      .withIndex("by_user_and_content", (q) =>
        q
          .eq("userId", userId)
          .eq("contentType", args.contentType)
          .eq("contentId", args.contentId)
      )
      .first();

    if (highlights) {
      await ctx.db.delete(highlights._id);
    }
  },
});

/**
 * List all highlights for the authenticated user
 *
 * Returns highlights across all content types, sorted by most recently updated.
 * Useful for future "All My Highlights" feature.
 */
export const listUserHighlights = query({
  args: {},
  handler: async (ctx) => {
    // Get authenticated user ID from Auth0
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return [];
    }
    const userId = identity.subject;

    const highlights = await ctx.db
      .query("highlights")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    // Sort by updatedAt descending (most recent first)
    return highlights.sort((a, b) => b.updatedAt - a.updatedAt);
  },
});
