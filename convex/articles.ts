import { action, mutation, query, internalAction, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { api, internal } from "./_generated/api";
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
    // Authenticate user (mutation will get userId from auth context)
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
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
      readingTimeMinutes: parsed.readingTimeMinutes,
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
    readingTimeMinutes: v.number(),
    tags: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    // Get authenticated user ID from Auth0
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }
    const userId = identity.subject; // Use Auth0 subject as userId

    // Check if article already exists for this user (using efficient index lookup)
    const existing = await ctx.db
      .query("articles")
      .withIndex("by_user_url", (q) => q.eq("userId", userId).eq("url", args.url))
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

    // Insert article metadata (without content)
    const articleId = await ctx.db.insert("articles", {
      userId: userId,
      url: args.url,
      title: args.title,
      excerpt: args.excerpt,
      imageUrl: args.imageUrl,
      author: args.author,
      publishedAt: args.publishedAt,
      readingTimeMinutes: args.readingTimeMinutes,
      savedAt: Date.now(),
      tags: uniqueTags,
    });

    // Insert content separately (reduces bandwidth for list queries)
    await ctx.db.insert("articleContent", {
      articleId: articleId,
      content: args.content,
    });

    return articleId;
  },
});

/**
 * List articles for the authenticated user
 * Supports filtering by tag and archived status
 *
 * Performance: Uses proper indexes and database-level sorting/limiting
 * to avoid loading all articles into memory
 */
export const listArticles = query({
  args: {
    tag: v.optional(v.string()),
    limit: v.optional(v.number()),
    archived: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    // Get authenticated user ID from Auth0
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }
    const userId = identity.subject; // Use Auth0 subject as userId

    const limit = args.limit || 50;

    // Use by_user_saved index for efficient sorting by savedAt (newest first)
    // This avoids loading all articles and sorting in memory
    const query = ctx.db
      .query("articles")
      .withIndex("by_user_saved", (q) => q.eq("userId", userId))
      .order("desc");

    // When filtering, we need to fetch more items to account for items
    // that will be filtered out. This is still much better than .collect()
    const hasFilters = args.archived !== undefined || args.tag !== undefined;
    const fetchLimit = hasFilters ? limit * 3 : limit;

    // Take only what we need from the database
    const articles = await query.take(fetchLimit);

    // Apply filters on the limited result set
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

    // Return articles WITHOUT the content field (huge performance gain)
    // Content is only loaded when viewing a single article via getArticle
    return filtered.slice(0, limit).map((article) => ({
      _id: article._id,
      _creationTime: article._creationTime,
      userId: article.userId,
      url: article.url,
      title: article.title,
      excerpt: article.excerpt,
      imageUrl: article.imageUrl,
      author: article.author,
      publishedAt: article.publishedAt,
      savedAt: article.savedAt,
      readAt: article.readAt,
      archived: article.archived,
      favorited: article.favorited,
      readingTimeMinutes: article.readingTimeMinutes,
      tags: article.tags,
    }));
  },
});

/**
 * Get a single article by ID
 * Joins with articleContent table to return full article with content
 */
export const getArticle = query({
  args: {
    articleId: v.id("articles"),
  },
  handler: async (ctx, args) => {
    // Get authenticated user ID from Auth0
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }
    const userId = identity.subject; // Use Auth0 subject as userId

    // Get article metadata
    const article = await ctx.db.get(args.articleId);
    if (!article) {
      throw new Error("Article not found");
    }

    // Check ownership
    if (article.userId !== userId) {
      throw new Error("Unauthorized");
    }

    // Get content from separate table (new articles)
    const contentDoc = await ctx.db
      .query("articleContent")
      .withIndex("by_article", (q) => q.eq("articleId", args.articleId))
      .first();

    // Return article with content joined
    // Fallback to legacy content field for old articles during migration
    return {
      ...article,
      content: contentDoc?.content ?? article.content ?? "",
    };
  },
});

/**
 * Delete an article
 * Also deletes associated content from articleContent table
 */
export const deleteArticle = mutation({
  args: {
    articleId: v.id("articles"),
  },
  handler: async (ctx, args) => {
    // Get authenticated user ID from Auth0
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }
    const userId = identity.subject; // Use Auth0 subject as userId

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

    // Delete content from separate table first
    const contentDoc = await ctx.db
      .query("articleContent")
      .withIndex("by_article", (q) => q.eq("articleId", args.articleId))
      .first();
    if (contentDoc) {
      await ctx.db.delete(contentDoc._id);
    }

    // Delete article metadata
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
    // Get authenticated user ID from Auth0
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }
    const userId = identity.subject; // Use Auth0 subject as userId

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
      // Tag already exists, silently succeed (idempotent operation)
      return { success: true, alreadyExists: true };
    }

    // Add tag
    const tags = [...article.tags, displayName];

    await ctx.db.patch(args.articleId, { tags });

    // Increment tag count
    await ctx.runMutation(api.tags.incrementTagCount, { tagName: displayName });

    return { success: true, alreadyExists: false };
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
    // Get authenticated user ID from Auth0
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }
    const userId = identity.subject; // Use Auth0 subject as userId

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
    readAt: v.optional(v.union(v.number(), v.null())),
    archived: v.optional(v.boolean()),
    favorited: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    // Get authenticated user ID from Auth0
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }
    const userId = identity.subject; // Use Auth0 subject as userId

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
    if (args.readAt !== undefined) {
      // null means clear the field, number means set it
      updates.readAt = args.readAt === null ? undefined : args.readAt;
    }
    if (args.archived !== undefined) updates.archived = args.archived;
    if (args.favorited !== undefined) updates.favorited = args.favorited;

    await ctx.db.patch(args.articleId, updates);

    return { success: true };
  },
});

/**
 * Internal action to save an article for a specific user
 * Used by the RSS feed fetcher to automatically save articles
 */
export const saveArticleForUserInternal = internalAction({
  args: {
    userId: v.string(),
    url: v.string(),
  },
  handler: async (ctx, args) => {
    console.log(`[Feed] Parsing article: ${args.url}`);

    // Parse the article
    const parsed = await parseArticle(args.url);

    const authorInfo = parsed.author ? ` by ${parsed.author}` : "";
    console.log(`[Feed] Parsed successfully: "${parsed.title}"${authorInfo}`);

    // Save to database via internal mutation
    const articleId: Id<"articles"> = await ctx.runMutation(
      internal.articles.saveArticleToDBInternal,
      {
        userId: args.userId,
        url: args.url,
        title: parsed.title,
        content: parsed.content,
        excerpt: parsed.excerpt,
        imageUrl: parsed.imageUrl,
        author: parsed.author,
        publishedAt: parsed.publishedAt,
        readingTimeMinutes: parsed.readingTimeMinutes,
        tags: [], // No tags for auto-saved articles from feeds
      }
    );

    console.log(`[Feed] Saved article with ID: ${articleId}`);

    return { success: true, articleId };
  },
});

/**
 * Internal mutation to save article to database for a specific user
 * Called by saveArticleForUserInternal action
 * Does not use authentication context - userId is passed explicitly
 */
export const saveArticleToDBInternal = internalMutation({
  args: {
    userId: v.string(),
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
    // Check if article already exists for this user (using efficient index lookup)
    const existing = await ctx.db
      .query("articles")
      .withIndex("by_user_url", (q) => q.eq("userId", args.userId).eq("url", args.url))
      .first();

    if (existing) {
      // Article already exists, don't throw error, just return the existing ID
      return existing._id;
    }

    // Normalize tags (if any)
    const normalizedTags: string[] = [];
    for (const tag of args.tags) {
      if (tag.trim()) {
        // Note: We can't call normalizeAndCreateTag here because it requires auth context
        // For feed articles, we just use tags as-is without normalization
        normalizedTags.push(tag.trim());
      }
    }

    // Remove duplicates
    const uniqueTags = Array.from(
      new Map(normalizedTags.map((tag) => [tag.toLowerCase(), tag])).values()
    );

    // Insert article metadata (without content)
    const articleId = await ctx.db.insert("articles", {
      userId: args.userId,
      url: args.url,
      title: args.title,
      excerpt: args.excerpt,
      imageUrl: args.imageUrl,
      author: args.author,
      publishedAt: args.publishedAt,
      readingTimeMinutes: args.readingTimeMinutes,
      savedAt: Date.now(),
      tags: uniqueTags,
    });

    // Insert content separately (reduces bandwidth for list queries)
    await ctx.db.insert("articleContent", {
      articleId: articleId,
      content: args.content,
    });

    return articleId;
  },
});
