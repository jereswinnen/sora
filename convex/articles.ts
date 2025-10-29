import { action, mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { api } from "./_generated/api";
import { parseArticle } from "./parser";
import { Id } from "./_generated/dataModel";

/**
 * Save an article from a URL
 * This is an action because it needs to fetch external content
 */
export const saveArticle = action({
  args: {
    url: v.string(),
    tags: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args): Promise<Id<"articles">> => {
    // Get authenticated user
    const userId = await ctx.auth.getUserIdentity();
    if (!userId) {
      throw new Error("Not authenticated");
    }

    // Parse the article
    const parsed = await parseArticle(args.url);

    // Save to database via internal mutation
    const articleId: Id<"articles"> = await ctx.runMutation(api.articles.saveArticleToDB, {
      url: args.url,
      title: parsed.title,
      content: parsed.content,
      excerpt: parsed.excerpt,
      imageUrl: parsed.imageUrl,
      author: parsed.author,
      publishedAt: parsed.publishedAt,
      tags: args.tags || [],
    });

    return articleId;
  },
});

/**
 * Internal mutation to save article to database
 * Called by saveArticle action
 */
export const saveArticleToDB = mutation({
  args: {
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
    // Get authenticated user ID
    const userId = await ctx.auth.getUserIdentity();
    if (!userId) {
      throw new Error("Not authenticated");
    }

    // Check if article already exists for this user
    const existing = await ctx.db
      .query("articles")
      .filter((q) => q.and(q.eq(q.field("userId"), userId.subject), q.eq(q.field("url"), args.url)))
      .first();

    if (existing) {
      throw new Error("Article already saved");
    }

    // Insert article
    const articleId = await ctx.db.insert("articles", {
      userId: userId.subject,
      url: args.url,
      title: args.title,
      content: args.content,
      excerpt: args.excerpt,
      imageUrl: args.imageUrl,
      author: args.author,
      publishedAt: args.publishedAt,
      savedAt: Date.now(),
      tags: args.tags,
    });

    return articleId;
  },
});

/**
 * List articles for the authenticated user
 * Supports filtering by tag and archived status
 */
export const listArticles = query({
  args: {
    tag: v.optional(v.string()),
    limit: v.optional(v.number()),
    archived: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    // Get authenticated user
    const userId = await ctx.auth.getUserIdentity();
    if (!userId) {
      throw new Error("Not authenticated");
    }

    // Query articles for this user
    const articles = await ctx.db
      .query("articles")
      .withIndex("by_user", (q) => q.eq("userId", userId.subject))
      .collect();

    // Apply filters
    let filtered = articles;

    // Filter by archived status
    if (args.archived !== undefined) {
      filtered = filtered.filter((a) => (a.archived || false) === args.archived);
    }

    // Filter by tag
    if (args.tag) {
      filtered = filtered.filter((a) => a.tags.includes(args.tag!));
    }

    // Sort by saved date (newest first)
    filtered.sort((a, b) => b.savedAt - a.savedAt);

    // Apply limit
    const limit = args.limit || 50;
    return filtered.slice(0, limit);
  },
});

/**
 * Get a single article by ID
 */
export const getArticle = query({
  args: {
    articleId: v.id("articles"),
  },
  handler: async (ctx, args) => {
    // Get authenticated user
    const userId = await ctx.auth.getUserIdentity();
    if (!userId) {
      throw new Error("Not authenticated");
    }

    // Get article
    const article = await ctx.db.get(args.articleId);
    if (!article) {
      throw new Error("Article not found");
    }

    // Check ownership
    if (article.userId !== userId.subject) {
      throw new Error("Unauthorized");
    }

    return article;
  },
});

/**
 * Delete an article
 */
export const deleteArticle = mutation({
  args: {
    articleId: v.id("articles"),
  },
  handler: async (ctx, args) => {
    // Get authenticated user
    const userId = await ctx.auth.getUserIdentity();
    if (!userId) {
      throw new Error("Not authenticated");
    }

    // Get article
    const article = await ctx.db.get(args.articleId);
    if (!article) {
      throw new Error("Article not found");
    }

    // Check ownership
    if (article.userId !== userId.subject) {
      throw new Error("Unauthorized");
    }

    // Delete article
    await ctx.db.delete(args.articleId);

    return { success: true };
  },
});

/**
 * Add a tag to an article
 */
export const addTag = mutation({
  args: {
    articleId: v.id("articles"),
    tag: v.string(),
  },
  handler: async (ctx, args) => {
    // Get authenticated user
    const userId = await ctx.auth.getUserIdentity();
    if (!userId) {
      throw new Error("Not authenticated");
    }

    // Get article
    const article = await ctx.db.get(args.articleId);
    if (!article) {
      throw new Error("Article not found");
    }

    // Check ownership
    if (article.userId !== userId.subject) {
      throw new Error("Unauthorized");
    }

    // Add tag (avoid duplicates)
    const tags = [...new Set([...article.tags, args.tag])];

    await ctx.db.patch(args.articleId, { tags });

    return { success: true };
  },
});

/**
 * Remove a tag from an article
 */
export const removeTag = mutation({
  args: {
    articleId: v.id("articles"),
    tag: v.string(),
  },
  handler: async (ctx, args) => {
    // Get authenticated user
    const userId = await ctx.auth.getUserIdentity();
    if (!userId) {
      throw new Error("Not authenticated");
    }

    // Get article
    const article = await ctx.db.get(args.articleId);
    if (!article) {
      throw new Error("Article not found");
    }

    // Check ownership
    if (article.userId !== userId.subject) {
      throw new Error("Unauthorized");
    }

    // Remove tag
    const tags = article.tags.filter((t) => t !== args.tag);

    await ctx.db.patch(args.articleId, { tags });

    return { success: true };
  },
});

/**
 * Update article metadata
 */
export const updateArticle = mutation({
  args: {
    articleId: v.id("articles"),
    readAt: v.optional(v.number()),
    archived: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    // Get authenticated user
    const userId = await ctx.auth.getUserIdentity();
    if (!userId) {
      throw new Error("Not authenticated");
    }

    // Get article
    const article = await ctx.db.get(args.articleId);
    if (!article) {
      throw new Error("Article not found");
    }

    // Check ownership
    if (article.userId !== userId.subject) {
      throw new Error("Unauthorized");
    }

    // Update fields
    const updates: Partial<typeof article> = {};
    if (args.readAt !== undefined) updates.readAt = args.readAt;
    if (args.archived !== undefined) updates.archived = args.archived;

    await ctx.db.patch(args.articleId, updates);

    return { success: true };
  },
});
