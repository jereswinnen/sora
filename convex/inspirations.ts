import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { api } from "./_generated/api";

/**
 * Generate an upload URL for file storage
 * Returns a short-lived URL that can be used to upload a file
 */
export const generateUploadUrl = mutation({
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }
    return await ctx.storage.generateUploadUrl();
  },
});

/**
 * Save a new inspiration with an uploaded image
 */
export const saveInspiration = mutation({
  args: {
    storageId: v.id("_storage"),
    title: v.optional(v.string()),
    description: v.optional(v.string()),
    tags: v.optional(v.array(v.string())),
    width: v.optional(v.number()),
    height: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }
    const userId = identity.subject;

    // Normalize tags
    const normalizedTags: string[] = [];
    if (args.tags) {
      for (const tag of args.tags) {
        if (tag.trim()) {
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

    const inspirationId = await ctx.db.insert("inspirations", {
      userId,
      storageId: args.storageId,
      title: args.title,
      description: args.description,
      tags: uniqueTags,
      width: args.width,
      height: args.height,
      addedAt: Date.now(),
    });

    return inspirationId;
  },
});

/**
 * List inspirations for the authenticated user
 * Supports cursor-based pagination for infinite scroll
 */
export const listInspirations = query({
  args: {
    tag: v.optional(v.string()),
    limit: v.optional(v.number()),
    cursor: v.optional(v.number()), // addedAt timestamp for cursor-based pagination
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }
    const userId = identity.subject;

    const limit = args.limit || 20;

    // Query inspirations, newest first
    let inspirationsQuery = ctx.db
      .query("inspirations")
      .withIndex("by_user_added", (q) => q.eq("userId", userId))
      .order("desc");

    // Apply cursor for pagination (fetch items older than cursor)
    if (args.cursor) {
      inspirationsQuery = ctx.db
        .query("inspirations")
        .withIndex("by_user_added", (q) => q.eq("userId", userId).lt("addedAt", args.cursor!))
        .order("desc");
    }

    // Fetch more if tag filtering is needed
    const fetchLimit = args.tag ? limit * 3 : limit + 1;
    const inspirations = await inspirationsQuery.take(fetchLimit);

    // Apply tag filter
    let filtered = inspirations;
    if (args.tag) {
      const normalizedFilterTag = args.tag.toLowerCase();
      filtered = filtered.filter((i) =>
        i.tags.some((t) => t.toLowerCase() === normalizedFilterTag)
      );
    }

    // Determine if there are more items
    const hasMore = filtered.length > limit;
    const items = filtered.slice(0, limit);

    // Get image URLs for all items
    const itemsWithUrls = await Promise.all(
      items.map(async (item) => {
        const imageUrl = await ctx.storage.getUrl(item.storageId);
        return {
          ...item,
          imageUrl,
        };
      })
    );

    // Next cursor is the addedAt of the last item
    const nextCursor = items.length > 0 ? items[items.length - 1].addedAt : undefined;

    return {
      items: itemsWithUrls,
      nextCursor: hasMore ? nextCursor : undefined,
    };
  },
});

/**
 * Get a single inspiration by ID
 */
export const getInspiration = query({
  args: {
    inspirationId: v.id("inspirations"),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }
    const userId = identity.subject;

    const inspiration = await ctx.db.get(args.inspirationId);
    if (!inspiration) {
      throw new Error("Inspiration not found");
    }

    if (inspiration.userId !== userId) {
      throw new Error("Unauthorized");
    }

    const imageUrl = await ctx.storage.getUrl(inspiration.storageId);

    return {
      ...inspiration,
      imageUrl,
    };
  },
});

/**
 * Update inspiration metadata
 */
export const updateInspiration = mutation({
  args: {
    inspirationId: v.id("inspirations"),
    title: v.optional(v.string()),
    description: v.optional(v.string()),
    favorited: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }
    const userId = identity.subject;

    const inspiration = await ctx.db.get(args.inspirationId);
    if (!inspiration) {
      throw new Error("Inspiration not found");
    }

    if (inspiration.userId !== userId) {
      throw new Error("Unauthorized");
    }

    const updates: Partial<typeof inspiration> = {};
    if (args.title !== undefined) updates.title = args.title;
    if (args.description !== undefined) updates.description = args.description;
    if (args.favorited !== undefined) updates.favorited = args.favorited;

    await ctx.db.patch(args.inspirationId, updates);

    return { success: true };
  },
});

/**
 * Delete an inspiration and its stored file
 */
export const deleteInspiration = mutation({
  args: {
    inspirationId: v.id("inspirations"),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }
    const userId = identity.subject;

    const inspiration = await ctx.db.get(args.inspirationId);
    if (!inspiration) {
      throw new Error("Inspiration not found");
    }

    if (inspiration.userId !== userId) {
      throw new Error("Unauthorized");
    }

    // Decrement tag counts
    for (const tag of inspiration.tags) {
      await ctx.runMutation(api.tags.decrementTagCount, { tagName: tag });
    }

    // Delete the stored file
    await ctx.storage.delete(inspiration.storageId);

    // Delete the inspiration record
    await ctx.db.delete(args.inspirationId);

    return { success: true };
  },
});

/**
 * Add a tag to an inspiration
 */
export const addTag = mutation({
  args: {
    inspirationId: v.id("inspirations"),
    tag: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }
    const userId = identity.subject;

    const inspiration = await ctx.db.get(args.inspirationId);
    if (!inspiration) {
      throw new Error("Inspiration not found");
    }

    if (inspiration.userId !== userId) {
      throw new Error("Unauthorized");
    }

    // Normalize and create/update tag
    const displayName = await ctx.runMutation(api.tags.normalizeAndCreateTag, {
      tagName: args.tag,
    });

    // Check if tag already exists (case-insensitive)
    const tagExists = inspiration.tags.some(
      (existingTag) => existingTag.toLowerCase() === displayName.toLowerCase()
    );

    if (tagExists) {
      return { success: true, alreadyExists: true };
    }

    // Add tag
    const tags = [...inspiration.tags, displayName];
    await ctx.db.patch(args.inspirationId, { tags });

    // Increment tag count
    await ctx.runMutation(api.tags.incrementTagCount, { tagName: displayName });

    return { success: true, alreadyExists: false };
  },
});

/**
 * Remove a tag from an inspiration
 */
export const removeTag = mutation({
  args: {
    inspirationId: v.id("inspirations"),
    tag: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }
    const userId = identity.subject;

    const inspiration = await ctx.db.get(args.inspirationId);
    if (!inspiration) {
      throw new Error("Inspiration not found");
    }

    if (inspiration.userId !== userId) {
      throw new Error("Unauthorized");
    }

    // Find the tag to remove (case-insensitive)
    const tagToRemove = inspiration.tags.find(
      (t) => t.toLowerCase() === args.tag.toLowerCase()
    );

    if (!tagToRemove) {
      throw new Error("Tag not found on this inspiration");
    }

    // Remove tag
    const tags = inspiration.tags.filter((t) => t !== tagToRemove);
    await ctx.db.patch(args.inspirationId, { tags });

    // Decrement tag count
    await ctx.runMutation(api.tags.decrementTagCount, { tagName: tagToRemove });

    return { success: true };
  },
});

/**
 * Toggle favorite status
 */
export const toggleFavorite = mutation({
  args: {
    inspirationId: v.id("inspirations"),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }
    const userId = identity.subject;

    const inspiration = await ctx.db.get(args.inspirationId);
    if (!inspiration) {
      throw new Error("Inspiration not found");
    }

    if (inspiration.userId !== userId) {
      throw new Error("Unauthorized");
    }

    await ctx.db.patch(args.inspirationId, {
      favorited: !inspiration.favorited,
    });

    return { success: true, favorited: !inspiration.favorited };
  },
});
