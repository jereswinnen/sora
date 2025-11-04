import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { authTables } from "@convex-dev/auth/server";

/**
 * Sora Database Schema
 *
 * Design Philosophy:
 * - Extensible: Easy to add new content types (books, highlights, reading lists)
 * - Modular: Separate tables for different concerns
 * - User-centric: All content is tied to users for isolation
 *
 * Future Extensions:
 * - books: Book tracking with reading progress
 * - highlights: Text selections from articles/books
 * - readingLists: Collections of content items
 * - notes: User annotations on content
 */

const schema = defineSchema({
  // Convex Auth tables for user authentication
  ...authTables,

  // Articles: Saved web articles for reading later
  articles: defineTable({
    userId: v.string(), // Convex Auth user ID from getUserIdentity().subject
    url: v.string(),
    title: v.string(),
    content: v.string(),
    excerpt: v.optional(v.string()),
    imageUrl: v.optional(v.string()),
    author: v.optional(v.string()),
    publishedAt: v.optional(v.number()),
    savedAt: v.number(),
    readAt: v.optional(v.number()),
    archived: v.optional(v.boolean()),
    favorited: v.optional(v.boolean()),
    readingTimeMinutes: v.optional(v.number()),
    tags: v.array(v.string()),
  })
    .index("by_user", ["userId"])
    .index("by_user_saved", ["userId", "savedAt"])
    .index("by_user_archived", ["userId", "archived"])
    .searchIndex("search_title", {
      searchField: "title",
      filterFields: ["userId"],
    })
    .searchIndex("search_content", {
      searchField: "content",
      filterFields: ["userId"],
    }),

  // Tags: User-defined labels for organizing content
  // Uses normalized names for case-insensitive matching while preserving display names
  tags: defineTable({
    userId: v.string(), // Convex Auth user ID
    name: v.string(), // Normalized lowercase name for matching
    displayName: v.string(), // Original case for display
    count: v.number(), // Number of articles using this tag
    lastUsedAt: v.number(), // Last time this tag was used
    createdAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_user_name", ["userId", "name"]),

  // User preferences and settings
  // Modular structure - each category of settings can be extended independently
  userPreferences: defineTable({
    userId: v.string(), // Convex Auth user ID

    // Article reading appearance
    articleTheme: v.optional(v.union(v.literal("sans"), v.literal("serif"))),
    articleTitleSize: v.optional(v.number()),
    articleTitleLeading: v.optional(v.number()),
    articleTitleAlignment: v.optional(v.union(v.literal("left"), v.literal("center"))),
    articleBodySize: v.optional(v.number()),
    articleBodyLeading: v.optional(v.number()),
    articleMargins: v.optional(v.union(v.literal("narrow"), v.literal("normal"), v.literal("wide"))),
    articleJustifyText: v.optional(v.boolean()),
  }).index("by_user", ["userId"]),

  // Books: Track reading progress and metadata
  books: defineTable({
    userId: v.string(), // Convex Auth user ID
    coverUrl: v.optional(v.string()),
    title: v.string(),
    author: v.optional(v.string()),
    publishedYear: v.optional(v.number()),
    status: v.string(), // "not_started", "reading", "finished", "abandoned"
    tags: v.array(v.string()),
    favorited: v.optional(v.boolean()),
    dateStarted: v.optional(v.number()),
    dateRead: v.optional(v.number()),
    addedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_user_status", ["userId", "status"])
    .index("by_user_added", ["userId", "addedAt"]),
});

export default schema;

/**
 * Future Schema Extensions:
 *
 * books: defineTable({
 *   userId: v.id("users"),
 *   title: v.string(),
 *   author: v.string(),
 *   isbn: v.optional(v.string()),
 *   coverUrl: v.optional(v.string()),
 *   status: v.union(v.literal("to-read"), v.literal("reading"), v.literal("finished")),
 *   progress: v.optional(v.number()), // 0-100 percentage
 *   startedAt: v.optional(v.number()),
 *   finishedAt: v.optional(v.number()),
 *   tags: v.array(v.string()),
 * })
 *
 * highlights: defineTable({
 *   userId: v.id("users"),
 *   contentType: v.union(v.literal("article"), v.literal("book")),
 *   contentId: v.string(), // Reference to article or book
 *   text: v.string(),
 *   location: v.optional(v.string()), // Page number, section, etc.
 *   color: v.optional(v.string()),
 *   createdAt: v.number(),
 *   note: v.optional(v.string()),
 * })
 *
 * readingLists: defineTable({
 *   userId: v.id("users"),
 *   name: v.string(),
 *   description: v.optional(v.string()),
 *   items: v.array(v.object({
 *     type: v.union(v.literal("article"), v.literal("book")),
 *     id: v.string(),
 *     order: v.number(),
 *   })),
 *   createdAt: v.number(),
 *   updatedAt: v.number(),
 * })
 */
