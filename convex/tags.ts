import { internalMutation, mutation, query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";

/**
 * Get all tags for the authenticated user
 * Returns tags sorted by usage count (descending) and last used date (descending)
 */
export const getAllTags = query({
  args: {},
  handler: async (ctx) => {
    // Get authenticated user ID
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      throw new Error("Not authenticated");
    }

    // Query tags for this user
    const tags = await ctx.db
      .query("tags")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    // Sort by count (descending) and lastUsedAt (descending)
    tags.sort((a, b) => {
      if (a.count !== b.count) {
        return b.count - a.count;
      }
      return b.lastUsedAt - a.lastUsedAt;
    });

    return tags;
  },
});

/**
 * Normalize a tag name to lowercase for case-insensitive matching
 */
function normalizeTagName(tagName: string): string {
  return tagName.trim().toLowerCase();
}

/**
 * Normalize and create/update a tag
 * Returns the displayName to use for the tag
 *
 * This function:
 * 1. Normalizes the tag name to lowercase
 * 2. Checks if the tag exists (case-insensitive)
 * 3. Creates it if it doesn't exist
 * 4. Updates lastUsedAt if it does exist
 * 5. Returns the displayName to use
 */
export const normalizeAndCreateTag = mutation({
  args: {
    tagName: v.string(),
  },
  handler: async (ctx, args) => {
    // Get authenticated user ID
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      throw new Error("Not authenticated");
    }

    // Normalize the tag name
    const normalizedName = normalizeTagName(args.tagName);

    // Check if tag exists (case-insensitive)
    const existingTag = await ctx.db
      .query("tags")
      .withIndex("by_user_name", (q) => q.eq("userId", userId).eq("name", normalizedName))
      .first();

    if (existingTag) {
      // Tag exists, update lastUsedAt and return existing displayName
      await ctx.db.patch(existingTag._id, {
        lastUsedAt: Date.now(),
      });
      return existingTag.displayName;
    } else {
      // Tag doesn't exist, create it
      await ctx.db.insert("tags", {
        userId: userId,
        name: normalizedName,
        displayName: args.tagName.trim(), // Preserve original case
        count: 0, // Will be incremented by incrementTagCount
        lastUsedAt: Date.now(),
        createdAt: Date.now(),
      });
      return args.tagName.trim();
    }
  },
});

/**
 * Increment the count for a tag
 */
export const incrementTagCount = mutation({
  args: {
    tagName: v.string(),
  },
  handler: async (ctx, args) => {
    // Get authenticated user ID
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      throw new Error("Not authenticated");
    }

    // Normalize the tag name
    const normalizedName = normalizeTagName(args.tagName);

    // Find the tag
    const tag = await ctx.db
      .query("tags")
      .withIndex("by_user_name", (q) => q.eq("userId", userId).eq("name", normalizedName))
      .first();

    if (tag) {
      // Increment count and update lastUsedAt
      await ctx.db.patch(tag._id, {
        count: tag.count + 1,
        lastUsedAt: Date.now(),
      });
    }
  },
});

/**
 * Decrement the count for a tag
 * If count reaches 0, the tag is kept (for tag history/suggestions)
 */
export const decrementTagCount = mutation({
  args: {
    tagName: v.string(),
  },
  handler: async (ctx, args) => {
    // Get authenticated user ID
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      throw new Error("Not authenticated");
    }

    // Normalize the tag name
    const normalizedName = normalizeTagName(args.tagName);

    // Find the tag
    const tag = await ctx.db
      .query("tags")
      .withIndex("by_user_name", (q) => q.eq("userId", userId).eq("name", normalizedName))
      .first();

    if (tag && tag.count > 0) {
      // Decrement count
      await ctx.db.patch(tag._id, {
        count: tag.count - 1,
      });
    }
  },
});

/**
 * Internal mutation: Normalize and create/update a tag for a specific user
 * Used by dev tools to bypass authentication checks
 */
export const normalizeAndCreateTagForUser = internalMutation({
  args: {
    userId: v.id("users"),
    tagName: v.string(),
  },
  handler: async (ctx, args) => {
    // Normalize the tag name
    const normalizedName = normalizeTagName(args.tagName);

    // Check if tag exists (case-insensitive)
    const existingTag = await ctx.db
      .query("tags")
      .withIndex("by_user_name", (q) =>
        q.eq("userId", args.userId).eq("name", normalizedName)
      )
      .first();

    if (existingTag) {
      // Tag exists, update lastUsedAt and return existing displayName
      await ctx.db.patch(existingTag._id, {
        lastUsedAt: Date.now(),
      });
      return existingTag.displayName;
    } else {
      // Tag doesn't exist, create it
      await ctx.db.insert("tags", {
        userId: args.userId,
        name: normalizedName,
        displayName: args.tagName.trim(), // Preserve original case
        count: 0, // Will be incremented by incrementTagCount
        lastUsedAt: Date.now(),
        createdAt: Date.now(),
      });
      return args.tagName.trim();
    }
  },
});

/**
 * Internal mutation: Increment the count for a tag for a specific user
 * Used by dev tools to bypass authentication checks
 */
export const incrementTagCountForUser = internalMutation({
  args: {
    userId: v.id("users"),
    tagName: v.string(),
  },
  handler: async (ctx, args) => {
    // Normalize the tag name
    const normalizedName = normalizeTagName(args.tagName);

    // Find the tag
    const tag = await ctx.db
      .query("tags")
      .withIndex("by_user_name", (q) =>
        q.eq("userId", args.userId).eq("name", normalizedName)
      )
      .first();

    if (tag) {
      // Increment count and update lastUsedAt
      await ctx.db.patch(tag._id, {
        count: tag.count + 1,
        lastUsedAt: Date.now(),
      });
    }
  },
});
