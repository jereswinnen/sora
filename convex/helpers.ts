import { internalMutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";

/**
 * Internal helper functions
 * These are used by dev tools and other internal operations
 */

/**
 * Get the first user in the database
 */
export const getFirstUser = internalQuery({
  args: {},
  handler: async (ctx) => {
    const user = await ctx.db.query("users").first();
    return user;
  },
});

/**
 * Save an article for a specific user (bypasses auth checks)
 * Used by dev tools
 */
export const saveArticleForUser = internalMutation({
  args: {
    userId: v.id("users"),
    url: v.string(),
    title: v.string(),
    content: v.string(),
    excerpt: v.string(),
    imageUrl: v.optional(v.string()),
    author: v.optional(v.string()),
    publishedAt: v.optional(v.number()),
    tags: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    // Check if article already exists for this user
    const existing = await ctx.db
      .query("articles")
      .filter((q) =>
        q.and(q.eq(q.field("userId"), args.userId), q.eq(q.field("url"), args.url))
      )
      .first();

    if (existing) {
      throw new Error("Article already saved");
    }

    // Normalize tags
    const normalizedTags: string[] = [];
    for (const tag of args.tags) {
      if (tag.trim()) {
        // Normalize and create/update tag, get displayName to use
        const displayName = await ctx.runMutation(
          internal.tags.normalizeAndCreateTagForUser,
          {
            userId: args.userId,
            tagName: tag,
          }
        );
        normalizedTags.push(displayName);
      }
    }

    // Remove duplicates (case-insensitive)
    const uniqueTags = Array.from(
      new Map(normalizedTags.map((tag) => [tag.toLowerCase(), tag])).values()
    );

    // Increment tag counts for unique tags
    for (const tag of uniqueTags) {
      await ctx.runMutation(internal.tags.incrementTagCountForUser, {
        userId: args.userId,
        tagName: tag,
      });
    }

    // Insert article
    const articleId = await ctx.db.insert("articles", {
      userId: args.userId,
      url: args.url,
      title: args.title,
      content: args.content,
      excerpt: args.excerpt,
      imageUrl: args.imageUrl,
      author: args.author,
      publishedAt: args.publishedAt,
      savedAt: Date.now(),
      tags: uniqueTags,
    });

    return articleId;
  },
});
