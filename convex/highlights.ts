import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { api } from "./_generated/api";

/**
 * Save highlights for a piece of content (article or book)
 * Replaces all existing highlights with the new set
 */
export const saveHighlights = mutation({
  args: {
    contentType: v.union(v.literal("article"), v.literal("book")),
    contentId: v.string(),
    serializedData: v.string(), // JSON array from TextHighlighter
    color: v.string(),
  },
  handler: async (ctx, args) => {
    // Get authenticated user ID from Auth0
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }
    const userId = identity.subject;

    // Parse the serialized data
    const highlights = JSON.parse(args.serializedData);

    // Delete all existing highlights for this content
    const existing = await ctx.db
      .query("highlights")
      .withIndex("by_user_and_content", (q) =>
        q
          .eq("userId", userId)
          .eq("contentType", args.contentType)
          .eq("contentId", args.contentId)
      )
      .collect();

    for (const h of existing) {
      await ctx.db.delete(h._id);
    }

    // If no highlights, just return (all deleted above)
    if (highlights.length === 0) {
      return [];
    }

    // Insert each highlight as a separate record
    const now = Date.now();
    const insertedIds = [];

    for (const highlight of highlights) {
      const id = await ctx.db.insert("highlights", {
        userId,
        contentType: args.contentType,
        contentId: args.contentId,
        wrapper: highlight.wrapper || "",
        textContent: highlight.textContent || "",
        path: highlight.path || "",
        offset: highlight.offset || 0,
        length: highlight.length || 0,
        color: args.color,
        tags: [], // Article highlights don't have tags initially
        createdAt: now,
      });
      insertedIds.push(id);
    }

    return insertedIds;
  },
});

/**
 * Get highlights for a specific piece of content
 *
 * Returns serialized data compatible with TextHighlighter.deserialize()
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
      .collect();

    if (highlights.length === 0) {
      return null;
    }

    // Filter out old-format records that don't have the new fields
    const validHighlights = highlights.filter(h => h.wrapper && h.textContent && h.path !== undefined);

    if (validHighlights.length === 0) {
      return null;
    }

    // Convert database records back to TextHighlighter format
    const serializedData = JSON.stringify(
      validHighlights.map((h) => ({
        wrapper: h.wrapper!,
        textContent: h.textContent!,
        path: h.path!,
        offset: h.offset || 0,
        length: h.length || 0,
        color: h.color,
      }))
    );

    return { serializedData };
  },
});

/**
 * Delete all highlights for a specific piece of content
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
      .collect();

    for (const h of highlights) {
      await ctx.db.delete(h._id);
    }
  },
});

/**
 * List all highlights for the authenticated user
 *
 * Returns highlights across all content types, sorted by most recently created.
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

    // Sort by createdAt descending (most recent first)
    return highlights.sort((a, b) => b.createdAt - a.createdAt);
  },
});

/**
 * DEBUG: List ALL highlights in the database (no auth check)
 */
export const debugListAllHighlights = query({
  args: {},
  handler: async (ctx) => {
    const highlights = await ctx.db.query("highlights").collect();
    return highlights;
  },
});

/**
 * Create a single highlight (for book highlights)
 */
export const createHighlight = mutation({
  args: {
    contentType: v.union(v.literal("article"), v.literal("book")),
    contentId: v.string(),
    textContent: v.string(),
    pageNumber: v.optional(v.number()),
    color: v.string(),
    tags: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    // Get authenticated user ID from Auth0
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }
    const userId = identity.subject;

    // Validate: book highlights require page number
    if (args.contentType === "book" && !args.pageNumber) {
      throw new Error("Page number is required for book highlights");
    }

    // Normalize tags (same pattern as books/articles)
    const normalizedTags: string[] = [];
    if (args.tags) {
      for (const tag of args.tags) {
        if (tag.trim()) {
          // Normalize and create/update tag, get displayName to use
          const displayName = await ctx.runMutation(api.tags.normalizeAndCreateTag, {
            tagName: tag,
          });
          normalizedTags.push(displayName);
        }
      }
    }

    // Remove duplicates (case-insensitive)
    const uniqueTags = Array.from(
      new Map(normalizedTags.map((tag) => [tag.toLowerCase(), tag])).values()
    );

    // Increment tag counts for unique tags
    for (const tag of uniqueTags) {
      await ctx.runMutation(api.tags.incrementTagCount, { tagName: tag });
    }

    // Create the highlight
    const highlightId = await ctx.db.insert("highlights", {
      userId,
      contentType: args.contentType,
      contentId: args.contentId,
      textContent: args.textContent,
      pageNumber: args.pageNumber,
      color: args.color,
      tags: uniqueTags,
      createdAt: Date.now(),
    });

    return highlightId;
  },
});

/**
 * Delete a single highlight by ID
 */
export const deleteHighlight = mutation({
  args: {
    highlightId: v.id("highlights"),
  },
  handler: async (ctx, args) => {
    // Get authenticated user ID from Auth0
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }
    const userId = identity.subject;

    // Get the highlight to verify ownership
    const highlight = await ctx.db.get(args.highlightId);
    if (!highlight) {
      throw new Error("Highlight not found");
    }

    // Verify the highlight belongs to the user
    if (highlight.userId !== userId) {
      throw new Error("Not authorized to delete this highlight");
    }

    // Decrement tag counts for all tags on this highlight
    for (const tag of highlight.tags || []) {
      await ctx.runMutation(api.tags.decrementTagCount, { tagName: tag });
    }

    // Delete the highlight
    await ctx.db.delete(args.highlightId);
  },
});

/**
 * List highlights for a book, sorted by page number
 */
export const listBookHighlights = query({
  args: {
    bookId: v.id("books"),
  },
  handler: async (ctx, args) => {
    // Get authenticated user ID from Auth0
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return [];
    }
    const userId = identity.subject;

    const highlights = await ctx.db
      .query("highlights")
      .withIndex("by_user_and_content", (q) =>
        q
          .eq("userId", userId)
          .eq("contentType", "book")
          .eq("contentId", args.bookId)
      )
      .collect();

    // Sort by page number (ascending), with null/undefined page numbers last
    return highlights.sort((a, b) => {
      const pageA = a.pageNumber ?? Number.MAX_SAFE_INTEGER;
      const pageB = b.pageNumber ?? Number.MAX_SAFE_INTEGER;
      return pageA - pageB;
    });
  },
});

/**
 * Add a tag to a highlight
 */
export const addTag = mutation({
  args: {
    highlightId: v.id("highlights"),
    tag: v.string(),
  },
  handler: async (ctx, args) => {
    // Get authenticated user ID from Auth0
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }
    const userId = identity.subject;

    // Get highlight
    const highlight = await ctx.db.get(args.highlightId);
    if (!highlight) {
      throw new Error("Highlight not found");
    }

    // Check ownership
    if (highlight.userId !== userId) {
      throw new Error("Unauthorized");
    }

    // Normalize and create/update tag, get displayName to use
    const displayName = await ctx.runMutation(api.tags.normalizeAndCreateTag, {
      tagName: args.tag,
    });

    // Check if tag already exists (case-insensitive)
    const tagExists = (highlight.tags || []).some(
      (existingTag) => existingTag.toLowerCase() === displayName.toLowerCase()
    );

    if (tagExists) {
      // Tag already exists, silently succeed (idempotent operation)
      return { success: true, alreadyExists: true };
    }

    // Add tag
    const tags = [...(highlight.tags || []), displayName];

    await ctx.db.patch(args.highlightId, { tags });

    // Increment tag count
    await ctx.runMutation(api.tags.incrementTagCount, { tagName: displayName });

    return { success: true, alreadyExists: false };
  },
});

/**
 * Remove a tag from a highlight
 */
export const removeTag = mutation({
  args: {
    highlightId: v.id("highlights"),
    tag: v.string(),
  },
  handler: async (ctx, args) => {
    // Get authenticated user ID from Auth0
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }
    const userId = identity.subject;

    // Get highlight
    const highlight = await ctx.db.get(args.highlightId);
    if (!highlight) {
      throw new Error("Highlight not found");
    }

    // Check ownership
    if (highlight.userId !== userId) {
      throw new Error("Unauthorized");
    }

    // Find the tag to remove (case-insensitive)
    const tagToRemove = (highlight.tags || []).find(
      (t) => t.toLowerCase() === args.tag.toLowerCase()
    );

    if (!tagToRemove) {
      throw new Error("Tag not found on this highlight");
    }

    // Remove tag
    const tags = (highlight.tags || []).filter((t) => t !== tagToRemove);

    await ctx.db.patch(args.highlightId, { tags });

    // Decrement tag count
    await ctx.runMutation(api.tags.decrementTagCount, { tagName: tagToRemove });

    return { success: true };
  },
});
