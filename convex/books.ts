import { action, mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { api } from "./_generated/api";

/**
 * Add a new book
 */
export const addBook = mutation({
  args: {
    coverUrl: v.optional(v.string()),
    title: v.string(),
    author: v.optional(v.string()),
    publishedDate: v.optional(v.number()),
    status: v.optional(v.string()),
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

    // Check if book already exists for this user (same title and author)
    const existing = await ctx.db
      .query("books")
      .filter((q) =>
        q.and(
          q.eq(q.field("userId"), userId),
          q.eq(q.field("title"), args.title),
          q.eq(q.field("author"), args.author || undefined)
        )
      )
      .first();

    if (existing) {
      throw new Error("Book already added to your collection");
    }

    const status = args.status || "not_started";

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

    // Set dateStarted if status is "reading"
    const dateStarted = status === "reading" ? Date.now() : undefined;

    // Insert book
    const bookId = await ctx.db.insert("books", {
      userId: userId,
      coverUrl: args.coverUrl,
      title: args.title,
      author: args.author,
      publishedDate: args.publishedDate,
      status: status,
      tags: uniqueTags,
      favorited: args.favorited || false,
      dateStarted: dateStarted,
      addedAt: Date.now(),
    });

    return bookId;
  },
});

/**
 * List books for the authenticated user
 * Supports filtering by status and tag
 *
 * Performance: Uses proper indexes and database-level sorting/limiting
 * to avoid loading all books into memory
 */
export const listBooks = query({
  args: {
    status: v.optional(v.string()),
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

    // If filtering by status, use the by_user_status index
    // Otherwise, use by_user_added for newest-first sorting
    let books;
    if (args.status) {
      const status = args.status; // Store in variable for type narrowing
      books = await ctx.db
        .query("books")
        .withIndex("by_user_status", (q) =>
          q.eq("userId", userId).eq("status", status)
        )
        .take(limit * 2); // Fetch more for tag filtering if needed
    } else {
      books = await ctx.db
        .query("books")
        .withIndex("by_user_added", (q) => q.eq("userId", userId))
        .order("desc")
        .take(args.tag ? limit * 2 : limit); // Fetch more for tag filtering if needed
    }

    // Apply tag filter on the limited result set
    let filtered = books;
    if (args.tag) {
      const normalizedFilterTag = args.tag.toLowerCase();
      filtered = filtered.filter((b) =>
        b.tags.some((t) => t.toLowerCase() === normalizedFilterTag)
      );
    }

    // If we used by_user_status index, sort by addedAt (newest first)
    if (args.status) {
      filtered.sort((a, b) => b.addedAt - a.addedAt);
    }

    // Return up to the requested limit
    return filtered.slice(0, limit);
  },
});

/**
 * Get a single book by ID
 */
export const getBook = query({
  args: {
    bookId: v.id("books"),
  },
  handler: async (ctx, args) => {
    // Get authenticated user ID from Auth0
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }
    const userId = identity.subject; // Use Auth0 subject as userId

    // Get book
    const book = await ctx.db.get(args.bookId);
    if (!book) {
      throw new Error("Book not found");
    }

    // Check ownership
    if (book.userId !== userId) {
      throw new Error("Unauthorized");
    }

    return book;
  },
});

/**
 * Update book metadata
 * Automatically sets dateStarted when status changes to "reading"
 * Automatically sets dateRead when status changes to "finished"
 */
export const updateBook = mutation({
  args: {
    bookId: v.id("books"),
    coverUrl: v.optional(v.string()),
    title: v.optional(v.string()),
    author: v.optional(v.string()),
    publishedDate: v.optional(v.number()),
    status: v.optional(v.string()),
    favorited: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    // Get authenticated user ID from Auth0
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }
    const userId = identity.subject; // Use Auth0 subject as userId

    // Get book
    const book = await ctx.db.get(args.bookId);
    if (!book) {
      throw new Error("Book not found");
    }

    // Check ownership
    if (book.userId !== userId) {
      throw new Error("Unauthorized");
    }

    // Build updates object
    const updates: Partial<typeof book> = {};

    if (args.coverUrl !== undefined) updates.coverUrl = args.coverUrl;
    if (args.title !== undefined) updates.title = args.title;
    if (args.author !== undefined) updates.author = args.author;
    if (args.publishedDate !== undefined) updates.publishedDate = args.publishedDate;
    if (args.favorited !== undefined) updates.favorited = args.favorited;

    // Handle status changes with automatic date setting
    if (args.status !== undefined) {
      updates.status = args.status;

      // If status changed to "reading" and dateStarted is not set, set it
      if (args.status === "reading" && !book.dateStarted) {
        updates.dateStarted = Date.now();
      }

      // If status changed to "finished" and dateRead is not set, set it
      if (args.status === "finished" && !book.dateRead) {
        updates.dateRead = Date.now();
      }
    }

    await ctx.db.patch(args.bookId, updates);

    return { success: true };
  },
});

/**
 * Delete a book
 */
export const deleteBook = mutation({
  args: {
    bookId: v.id("books"),
  },
  handler: async (ctx, args) => {
    // Get authenticated user ID from Auth0
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }
    const userId = identity.subject; // Use Auth0 subject as userId

    // Get book
    const book = await ctx.db.get(args.bookId);
    if (!book) {
      throw new Error("Book not found");
    }

    // Check ownership
    if (book.userId !== userId) {
      throw new Error("Unauthorized");
    }

    // Decrement tag counts for all tags on this book
    for (const tag of book.tags) {
      await ctx.runMutation(api.tags.decrementTagCount, { tagName: tag });
    }

    // Delete book
    await ctx.db.delete(args.bookId);

    return { success: true };
  },
});

/**
 * Add a tag to a book
 */
export const addTag = mutation({
  args: {
    bookId: v.id("books"),
    tag: v.string(),
  },
  handler: async (ctx, args) => {
    // Get authenticated user ID from Auth0
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }
    const userId = identity.subject; // Use Auth0 subject as userId

    // Get book
    const book = await ctx.db.get(args.bookId);
    if (!book) {
      throw new Error("Book not found");
    }

    // Check ownership
    if (book.userId !== userId) {
      throw new Error("Unauthorized");
    }

    // Normalize and create/update tag, get displayName to use
    const displayName = await ctx.runMutation(api.tags.normalizeAndCreateTag, {
      tagName: args.tag,
    });

    // Check if tag already exists (case-insensitive)
    const tagExists = book.tags.some(
      (existingTag) => existingTag.toLowerCase() === displayName.toLowerCase()
    );

    if (tagExists) {
      // Tag already exists, silently succeed (idempotent operation)
      return { success: true, alreadyExists: true };
    }

    // Add tag
    const tags = [...book.tags, displayName];

    await ctx.db.patch(args.bookId, { tags });

    // Increment tag count
    await ctx.runMutation(api.tags.incrementTagCount, { tagName: displayName });

    return { success: true, alreadyExists: false };
  },
});

/**
 * Remove a tag from a book
 */
export const removeTag = mutation({
  args: {
    bookId: v.id("books"),
    tag: v.string(),
  },
  handler: async (ctx, args) => {
    // Get authenticated user ID from Auth0
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }
    const userId = identity.subject; // Use Auth0 subject as userId

    // Get book
    const book = await ctx.db.get(args.bookId);
    if (!book) {
      throw new Error("Book not found");
    }

    // Check ownership
    if (book.userId !== userId) {
      throw new Error("Unauthorized");
    }

    // Find the tag to remove (case-insensitive)
    const tagToRemove = book.tags.find(
      (t) => t.toLowerCase() === args.tag.toLowerCase()
    );

    if (!tagToRemove) {
      throw new Error("Tag not found on this book");
    }

    // Remove tag
    const tags = book.tags.filter((t) => t !== tagToRemove);

    await ctx.db.patch(args.bookId, { tags });

    // Decrement tag count
    await ctx.runMutation(api.tags.decrementTagCount, { tagName: tagToRemove });

    return { success: true };
  },
});

/**
 * Search for books using the iTunes Search API
 */
export const searchBooks = action({
  args: {
    query: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    // Authenticate user
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const limit = args.limit || 20;
    const encodedQuery = encodeURIComponent(args.query);

    try {
      const response = await fetch(
        `https://itunes.apple.com/search?term=${encodedQuery}&entity=ebook&limit=${limit}`
      );

      if (!response.ok) {
        throw new Error(`iTunes API error: ${response.status}`);
      }

      const data = await response.json();

      // Define iTunes API response type
      interface iTunesResult {
        trackName?: string;
        artistName?: string;
        artworkUrl100?: string;
        releaseDate?: string;
        trackId: number;
      }

      interface iTunesResponse {
        results: iTunesResult[];
      }

      const typedData = data as iTunesResponse;

      // Transform the results into a clean format
      return typedData.results.map((book) => {
        // Upgrade artwork to 600x600 for higher resolution
        const coverUrl = book.artworkUrl100
          ? book.artworkUrl100.replace("100x100", "600x600")
          : undefined;

        // Parse release date to timestamp
        const publishedDate = book.releaseDate
          ? new Date(book.releaseDate).getTime()
          : undefined;

        return {
          title: book.trackName || "Untitled",
          author: book.artistName,
          coverUrl,
          publishedDate,
          trackId: book.trackId, // iTunes track ID
        };
      });
    } catch (error) {
      console.error("iTunes search error:", error);
      throw new Error("Failed to search iTunes");
    }
  },
});
