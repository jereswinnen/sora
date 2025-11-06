import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

/**
 * Get user preferences for the authenticated user
 */
export const get = query({
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;
    const userId = identity.subject;

    return await ctx.db
      .query("userPreferences")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();
  },
});

/**
 * Update article appearance preferences
 * Creates a new preferences document if one doesn't exist
 */
export const updateArticleAppearance = mutation({
  args: {
    articleTheme: v.optional(v.union(v.literal("sans"), v.literal("serif"))),
    articleTitleSize: v.optional(v.number()),
    articleTitleLeading: v.optional(v.number()),
    articleTitleAlignment: v.optional(
      v.union(v.literal("left"), v.literal("center"))
    ),
    articleBodySize: v.optional(v.number()),
    articleBodyLeading: v.optional(v.number()),
    articleMargins: v.optional(
      v.union(v.literal("narrow"), v.literal("normal"), v.literal("wide"))
    ),
    articleJustifyText: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    const userId = identity.subject;

    const existing = await ctx.db
      .query("userPreferences")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();

    if (existing) {
      // Update existing preferences
      await ctx.db.patch(existing._id, args);
    } else {
      // Create new preferences document
      await ctx.db.insert("userPreferences", { userId, ...args });
    }
  },
});
