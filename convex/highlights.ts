import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

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

    // Create the highlight
    const highlightId = await ctx.db.insert("highlights", {
      userId,
      contentType: args.contentType,
      contentId: args.contentId,
      textContent: args.textContent,
      pageNumber: args.pageNumber,
      color: args.color,
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
