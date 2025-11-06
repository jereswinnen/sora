import { internalMutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { Id } from "./_generated/dataModel";

/**
 * Internal helper functions
 * These are used by dev tools and other internal operations
 */

/**
 * Get the current authenticated user's ID from Auth0
 * With Auth0, we use the Auth0 subject as the userId (e.g., "auth0|...")
 *
 * NOTE: This requires you to be logged in and call it from an authenticated context
 */
export const getFirstUser = internalQuery({
  args: {
    // Pass the Auth0 subject manually since internal queries don't have auth context
    auth0Subject: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    if (!args.auth0Subject) {
      throw new Error(
        "No auth0Subject provided. You must be logged in first. " +
        "Pass your Auth0 user ID (found at /debug-auth or from Auth0 dashboard) as: " +
        '\'{"auth0Subject": "auth0|..."}\''
      );
    }

    // With Auth0, we don't store users in the database
    // Return a mock user object using the Auth0 subject as the ID
    return {
      _id: args.auth0Subject as Id<"users">,
      _creationTime: Date.now(),
      email: "dummy@example.com", // This won't be used
    };
  },
});

/**
 * Save an article for a specific user (bypasses auth checks)
 * Used by dev tools
 */
export const saveArticleForUser = internalMutation({
  args: {
    userId: v.string(), // Changed from v.id("users") to v.string() for Auth0 subjects
    url: v.string(),
    title: v.string(),
    content: v.string(),
    excerpt: v.string(),
    imageUrl: v.optional(v.string()),
    author: v.optional(v.string()),
    publishedAt: v.optional(v.number()),
    readingTimeMinutes: v.number(),
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
      readingTimeMinutes: args.readingTimeMinutes,
      savedAt: Date.now(),
      tags: uniqueTags,
    });

    return articleId;
  },
});
