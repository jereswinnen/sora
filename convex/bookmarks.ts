import { action, mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { api } from "./_generated/api";
import * as cheerio from "cheerio";

/**
 * Parsed bookmark metadata structure
 */
export interface ParsedBookmarkMetadata {
  title: string;
  faviconUrl?: string;
  normalizedUrl: string;
}

/**
 * Normalize URL by adding protocol if missing
 */
function normalizeUrl(url: string): string {
  const trimmed = url.trim();

  // If URL already has a protocol, return as-is
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    return trimmed;
  }

  // Add https:// prefix
  return `https://${trimmed}`;
}

/**
 * Fetch bookmark metadata (title and favicon) from a URL
 * This runs in a Convex action context (server-side)
 */
export const fetchBookmarkMetadata = action({
  args: {
    url: v.string(),
  },
  handler: async (ctx, args) => {
    // Authenticate user
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    try {
      // Normalize URL (add https:// if missing)
      const normalizedUrl = normalizeUrl(args.url);

      // Validate URL format
      const urlObj = new URL(normalizedUrl);

      // Fetch HTML
      const response = await fetch(normalizedUrl, {
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; SoraBot/1.0; +https://sora.app)",
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch: ${response.status} ${response.statusText}`);
      }

      const html = await response.text();

      // Load with Cheerio for metadata extraction
      const $ = cheerio.load(html);

      // Extract title
      const title =
        $('meta[property="og:title"]').attr("content") ||
        $('meta[name="twitter:title"]').attr("content") ||
        $("title").text() ||
        urlObj.hostname;

      // Extract favicon - prioritize actual favicon links over og:image
      let faviconUrl: string | undefined;

      // Try to find favicon link tags first (more reliable for favicons)
      const iconLink =
        $('link[rel="icon"]').attr("href") ||
        $('link[rel="shortcut icon"]').attr("href") ||
        $('link[rel="apple-touch-icon"]').attr("href");

      if (iconLink) {
        // Convert to absolute URL
        if (iconLink.startsWith("http://") || iconLink.startsWith("https://")) {
          faviconUrl = iconLink;
        } else if (iconLink.startsWith("//")) {
          faviconUrl = `${urlObj.protocol}${iconLink}`;
        } else if (iconLink.startsWith("/")) {
          faviconUrl = `${urlObj.origin}${iconLink}`;
        } else {
          faviconUrl = `${urlObj.origin}/${iconLink}`;
        }
      } else {
        // Fallback to standard favicon location
        faviconUrl = `${urlObj.origin}/favicon.ico`;
      }

      return {
        title: title.trim() || urlObj.hostname,
        faviconUrl,
        normalizedUrl, // Return the normalized URL so frontend can use it
      };
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to fetch bookmark metadata: ${error.message}`);
      }
      throw new Error("Failed to fetch bookmark metadata: Unknown error");
    }
  },
});

/**
 * Add a new bookmark
 */
export const addBookmark = mutation({
  args: {
    url: v.string(),
    title: v.string(),
    faviconUrl: v.optional(v.string()),
    tags: v.optional(v.array(v.string())),
    favorited: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    // Get authenticated user ID from Auth0
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }
    const userId = identity.subject; // Use Auth0 subject as userId

    // Validate URL format
    try {
      new URL(args.url);
    } catch {
      throw new Error("Invalid URL format");
    }

    // Check if bookmark already exists for this user (same URL)
    const existing = await ctx.db
      .query("bookmarks")
      .filter((q) =>
        q.and(q.eq(q.field("userId"), userId), q.eq(q.field("url"), args.url))
      )
      .first();

    if (existing) {
      throw new Error("Bookmark already exists");
    }

    // Normalize tags
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

    // Insert bookmark
    const bookmarkId = await ctx.db.insert("bookmarks", {
      userId: userId,
      url: args.url,
      title: args.title,
      faviconUrl: args.faviconUrl,
      tags: uniqueTags,
      favorited: args.favorited || false,
      addedAt: Date.now(),
    });

    return bookmarkId;
  },
});

/**
 * List bookmarks for the authenticated user
 * Supports filtering by tag
 *
 * Performance: Uses proper indexes and database-level sorting/limiting
 * to avoid loading all bookmarks into memory
 */
export const listBookmarks = query({
  args: {
    tag: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    // Get authenticated user ID from Auth0
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }
    const userId = identity.subject; // Use Auth0 subject as userId

    const limit = args.limit || 100;

    // Use by_user_added index for newest-first sorting
    const bookmarks = await ctx.db
      .query("bookmarks")
      .withIndex("by_user_added", (q) => q.eq("userId", userId))
      .order("desc")
      .take(args.tag ? limit * 2 : limit); // Fetch more for tag filtering if needed

    // Apply tag filter on the limited result set
    let filtered = bookmarks;
    if (args.tag) {
      const normalizedFilterTag = args.tag.toLowerCase();
      filtered = filtered.filter((b) =>
        b.tags.some((t) => t.toLowerCase() === normalizedFilterTag)
      );
    }

    // Return up to the requested limit
    return filtered.slice(0, limit);
  },
});

/**
 * Get a single bookmark by ID
 */
export const getBookmark = query({
  args: {
    bookmarkId: v.id("bookmarks"),
  },
  handler: async (ctx, args) => {
    // Get authenticated user ID from Auth0
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }
    const userId = identity.subject; // Use Auth0 subject as userId

    // Get bookmark
    const bookmark = await ctx.db.get(args.bookmarkId);
    if (!bookmark) {
      throw new Error("Bookmark not found");
    }

    // Check ownership
    if (bookmark.userId !== userId) {
      throw new Error("Unauthorized");
    }

    return bookmark;
  },
});

/**
 * Update bookmark metadata
 */
export const updateBookmark = mutation({
  args: {
    bookmarkId: v.id("bookmarks"),
    url: v.optional(v.string()),
    title: v.optional(v.string()),
    faviconUrl: v.optional(v.string()),
    favorited: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    // Get authenticated user ID from Auth0
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }
    const userId = identity.subject; // Use Auth0 subject as userId

    // Get bookmark
    const bookmark = await ctx.db.get(args.bookmarkId);
    if (!bookmark) {
      throw new Error("Bookmark not found");
    }

    // Check ownership
    if (bookmark.userId !== userId) {
      throw new Error("Unauthorized");
    }

    // Validate URL format if provided
    if (args.url !== undefined) {
      try {
        new URL(args.url);
      } catch {
        throw new Error("Invalid URL format");
      }
    }

    // Build updates object
    const updates: Partial<typeof bookmark> = {};

    if (args.url !== undefined) updates.url = args.url;
    if (args.title !== undefined) updates.title = args.title;
    if (args.faviconUrl !== undefined) updates.faviconUrl = args.faviconUrl;
    if (args.favorited !== undefined) updates.favorited = args.favorited;

    await ctx.db.patch(args.bookmarkId, updates);

    return { success: true };
  },
});

/**
 * Delete a bookmark
 */
export const deleteBookmark = mutation({
  args: {
    bookmarkId: v.id("bookmarks"),
  },
  handler: async (ctx, args) => {
    // Get authenticated user ID from Auth0
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }
    const userId = identity.subject; // Use Auth0 subject as userId

    // Get bookmark
    const bookmark = await ctx.db.get(args.bookmarkId);
    if (!bookmark) {
      throw new Error("Bookmark not found");
    }

    // Check ownership
    if (bookmark.userId !== userId) {
      throw new Error("Unauthorized");
    }

    // Decrement tag counts for all tags on this bookmark
    for (const tag of bookmark.tags) {
      await ctx.runMutation(api.tags.decrementTagCount, { tagName: tag });
    }

    // Delete bookmark
    await ctx.db.delete(args.bookmarkId);

    return { success: true };
  },
});

/**
 * Add a tag to a bookmark
 */
export const addTag = mutation({
  args: {
    bookmarkId: v.id("bookmarks"),
    tag: v.string(),
  },
  handler: async (ctx, args) => {
    // Get authenticated user ID from Auth0
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }
    const userId = identity.subject; // Use Auth0 subject as userId

    // Get bookmark
    const bookmark = await ctx.db.get(args.bookmarkId);
    if (!bookmark) {
      throw new Error("Bookmark not found");
    }

    // Check ownership
    if (bookmark.userId !== userId) {
      throw new Error("Unauthorized");
    }

    // Normalize and create/update tag, get displayName to use
    const displayName = await ctx.runMutation(api.tags.normalizeAndCreateTag, {
      tagName: args.tag,
    });

    // Check if tag already exists (case-insensitive)
    const tagExists = bookmark.tags.some(
      (existingTag) => existingTag.toLowerCase() === displayName.toLowerCase()
    );

    if (tagExists) {
      // Tag already exists, silently succeed (idempotent operation)
      return { success: true, alreadyExists: true };
    }

    // Add tag
    const tags = [...bookmark.tags, displayName];

    await ctx.db.patch(args.bookmarkId, { tags });

    // Increment tag count
    await ctx.runMutation(api.tags.incrementTagCount, { tagName: displayName });

    return { success: true, alreadyExists: false };
  },
});

/**
 * Remove a tag from a bookmark
 */
export const removeTag = mutation({
  args: {
    bookmarkId: v.id("bookmarks"),
    tag: v.string(),
  },
  handler: async (ctx, args) => {
    // Get authenticated user ID from Auth0
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }
    const userId = identity.subject; // Use Auth0 subject as userId

    // Get bookmark
    const bookmark = await ctx.db.get(args.bookmarkId);
    if (!bookmark) {
      throw new Error("Bookmark not found");
    }

    // Check ownership
    if (bookmark.userId !== userId) {
      throw new Error("Unauthorized");
    }

    // Find the tag to remove (case-insensitive)
    const tagToRemove = bookmark.tags.find(
      (t) => t.toLowerCase() === args.tag.toLowerCase()
    );

    if (!tagToRemove) {
      throw new Error("Tag not found on this bookmark");
    }

    // Remove tag
    const tags = bookmark.tags.filter((t) => t !== tagToRemove);

    await ctx.db.patch(args.bookmarkId, { tags });

    // Decrement tag count
    await ctx.runMutation(api.tags.decrementTagCount, { tagName: tagToRemove });

    return { success: true };
  },
});
