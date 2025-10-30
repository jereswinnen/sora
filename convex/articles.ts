import { action, mutation, query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
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
    // Get authenticated user ID
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      throw new Error("Not authenticated");
    }

    console.log(`Parsing article: ${args.url}`);

    // Parse the article
    const parsed = await parseArticle(args.url);

    const authorInfo = parsed.author ? ` by ${parsed.author}` : "";
    console.log(`Parsed successfully: "${parsed.title}"${authorInfo}`);

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

    console.log(`Saved article with ID: ${articleId}`);

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
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      throw new Error("Not authenticated");
    }

    // Check if article already exists for this user
    const existing = await ctx.db
      .query("articles")
      .filter((q) => q.and(q.eq(q.field("userId"), userId), q.eq(q.field("url"), args.url)))
      .first();

    if (existing) {
      throw new Error("Article already saved");
    }

    // Normalize tags
    const normalizedTags: string[] = [];
    for (const tag of args.tags) {
      if (tag.trim()) {
        // Normalize and create/update tag, get displayName to use
        const displayName = await ctx.runMutation(api.tags.normalizeAndCreateTag, {
          tagName: tag,
        });
        normalizedTags.push(displayName);
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

    // Insert article
    const articleId = await ctx.db.insert("articles", {
      userId: userId,
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
    // Get authenticated user ID
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      throw new Error("Not authenticated");
    }

    // Query articles for this user
    const articles = await ctx.db
      .query("articles")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    // Apply filters
    let filtered = articles;

    // Filter by archived status
    if (args.archived !== undefined) {
      filtered = filtered.filter((a) => (a.archived || false) === args.archived);
    }

    // Filter by tag (case-insensitive)
    if (args.tag) {
      const normalizedFilterTag = args.tag.toLowerCase();
      filtered = filtered.filter((a) =>
        a.tags.some((t) => t.toLowerCase() === normalizedFilterTag)
      );
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
    // Get authenticated user ID
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      throw new Error("Not authenticated");
    }

    // Get article
    const article = await ctx.db.get(args.articleId);
    if (!article) {
      throw new Error("Article not found");
    }

    // Check ownership
    if (article.userId !== userId) {
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
    // Get authenticated user ID
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      throw new Error("Not authenticated");
    }

    // Get article
    const article = await ctx.db.get(args.articleId);
    if (!article) {
      throw new Error("Article not found");
    }

    // Check ownership
    if (article.userId !== userId) {
      throw new Error("Unauthorized");
    }

    // Decrement tag counts for all tags on this article
    for (const tag of article.tags) {
      await ctx.runMutation(api.tags.decrementTagCount, { tagName: tag });
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
    // Get authenticated user ID
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      throw new Error("Not authenticated");
    }

    // Get article
    const article = await ctx.db.get(args.articleId);
    if (!article) {
      throw new Error("Article not found");
    }

    // Check ownership
    if (article.userId !== userId) {
      throw new Error("Unauthorized");
    }

    // Normalize and create/update tag, get displayName to use
    const displayName = await ctx.runMutation(api.tags.normalizeAndCreateTag, {
      tagName: args.tag,
    });

    // Check if tag already exists (case-insensitive)
    const tagExists = article.tags.some(
      (existingTag) => existingTag.toLowerCase() === displayName.toLowerCase()
    );

    if (tagExists) {
      throw new Error("Tag already exists on this article");
    }

    // Add tag
    const tags = [...article.tags, displayName];

    await ctx.db.patch(args.articleId, { tags });

    // Increment tag count
    await ctx.runMutation(api.tags.incrementTagCount, { tagName: displayName });

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
    // Get authenticated user ID
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      throw new Error("Not authenticated");
    }

    // Get article
    const article = await ctx.db.get(args.articleId);
    if (!article) {
      throw new Error("Article not found");
    }

    // Check ownership
    if (article.userId !== userId) {
      throw new Error("Unauthorized");
    }

    // Find the tag to remove (case-insensitive)
    const tagToRemove = article.tags.find(
      (t) => t.toLowerCase() === args.tag.toLowerCase()
    );

    if (!tagToRemove) {
      throw new Error("Tag not found on this article");
    }

    // Remove tag
    const tags = article.tags.filter((t) => t !== tagToRemove);

    await ctx.db.patch(args.articleId, { tags });

    // Decrement tag count
    await ctx.runMutation(api.tags.decrementTagCount, { tagName: tagToRemove });

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
    // Get authenticated user ID
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      throw new Error("Not authenticated");
    }

    // Get article
    const article = await ctx.db.get(args.articleId);
    if (!article) {
      throw new Error("Article not found");
    }

    // Check ownership
    if (article.userId !== userId) {
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
