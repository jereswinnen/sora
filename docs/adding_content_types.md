# Adding New Content Types to Sora

Sora is designed to be extensible. Here's the pattern for adding new content types (books, links, highlights, etc.).

---

## Authentication Pattern

**Always use the official Convex Auth API for getting the user ID:**

```typescript
import { getAuthUserId } from "@convex-dev/auth/server";

const userId = await getAuthUserId(ctx);
if (userId === null) {
  throw new Error("Not authenticated");
}
```

This returns the stable user document ID (`Id<"users">`), which remains consistent across sessions. Use this `userId` for all database operations.

---

## The Pattern (4 Steps)

### 1. Add Schema Table

**File:** `convex/schema.ts`

```typescript
// Example: Adding books
books: defineTable({
  userId: v.string(),
  title: v.string(),
  author: v.optional(v.string()),
  isbn: v.optional(v.string()),
  coverImageUrl: v.optional(v.string()),
  status: v.string(), // "reading", "finished", "want-to-read"
  startedAt: v.optional(v.number()),
  finishedAt: v.optional(v.number()),
  rating: v.optional(v.number()),
  notes: v.optional(v.string()),
  tags: v.array(v.string()),
})
  .index("by_user", ["userId"])
  .index("by_status", ["userId", "status"]),
```

### 2. Create Convex Functions

**File:** `convex/books.ts` (new file)

```typescript
import { v } from "convex/values";
import { action, mutation, query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { api } from "./_generated/api";

// Action - Fetch book metadata from external API (e.g., Google Books)
export const fetchBookMetadata = action({
  args: { isbn: v.string() },
  handler: async (ctx, args) => {
    const response = await fetch(
      `https://www.googleapis.com/books/v1/volumes?q=isbn:${args.isbn}`
    );
    const data = await response.json();
    // Parse and return book info
  },
});

// Mutation - Save book to database
export const saveBook = mutation({
  args: {
    title: v.string(),
    author: v.optional(v.string()),
    isbn: v.optional(v.string()),
    // ...
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not authenticated");

    return await ctx.db.insert("books", {
      userId: userId,
      ...args,
      tags: args.tags || [],
    });
  },
});

// Query - List books
export const listBooks = query({
  args: {
    status: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not authenticated");

    const books = await ctx.db
      .query("books")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    return books.slice(0, args.limit || 50);
  },
});

// Mutation - Update book
export const updateBook = mutation({
  args: {
    bookId: v.id("books"),
    status: v.optional(v.string()),
    rating: v.optional(v.number()),
    // ...
  },
  handler: async (ctx, args) => {
    const { bookId, ...updates } = args;
    await ctx.db.patch(bookId, updates);
  },
});

// Mutation - Delete book
export const deleteBook = mutation({
  args: { bookId: v.id("books") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.bookId);
  },
});
```

### 3. Build Web UI

**File:** `src/app/books/page.tsx` (new file)

```typescript
"use client";

import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "../../../convex/_generated/api";

export default function BooksPage() {
  const books = useQuery(api.books.listBooks, { limit: 50 });
  const saveBook = useMutation(api.books.saveBook);
  const deleteBook = useMutation(api.books.deleteBook);

  // Your UI here - calls the same Convex functions
}
```

### 4. Build iOS UI

**File:** iOS app - `BooksView.swift` (new file)

```swift
import ConvexMobile

struct BooksView: View {
    @State private var books: [Book] = []
    let client: ConvexClient

    func loadBooks() async {
        books = try await client.query("books:listBooks", ["limit": 50])
    }

    func saveBook(title: String, author: String) async {
        try await client.mutation("books:saveBook", [
            "title": title,
            "author": author
        ])
    }

    // Your UI here - calls the same Convex functions
}
```

---

## Key Points

✅ **Business logic lives in Convex functions** (`convex/books.ts`)
- Parsing, fetching external data, database operations

✅ **Clients (web + iOS) just call these functions**
- No duplication of logic
- Type-safe on both platforms

✅ **Authentication is handled automatically**
- `ctx.auth.getUserIdentity()` works in all Convex functions

✅ **Real-time sync is automatic**
- Changes on web appear instantly on iOS and vice versa

---

## Quick Reference: Content Type Ideas

| Content Type | Schema Fields | External API |
|-------------|---------------|--------------|
| **Books** | title, author, isbn, status, rating | Google Books API |
| **Links** | url, title, description, favicon | Similar to articles |
| **Reading Lists** | name, description, articleIds | N/A |
| **Highlights** | articleId, text, color, note | N/A |
| **Podcasts** | title, show, duration, playbackPosition | Podcast Index API |

---

## Example: Adding Quick Links

Minimal example for a simple content type:

```typescript
// 1. convex/schema.ts
links: defineTable({
  userId: v.string(),
  url: v.string(),
  title: v.string(),
  description: v.optional(v.string()),
  faviconUrl: v.optional(v.string()),
  tags: v.array(v.string()),
  savedAt: v.number(),
}).index("by_user", ["userId"]),

// 2. convex/links.ts
import { getAuthUserId } from "@convex-dev/auth/server";

export const saveLink = mutation({
  args: { url: v.string(), title: v.string(), tags: v.optional(v.array(v.string())) },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not authenticated");

    return await ctx.db.insert("links", {
      userId: userId,
      url: args.url,
      title: args.title,
      tags: args.tags || [],
      savedAt: Date.now(),
    });
  },
});

export const listLinks = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not authenticated");

    return await ctx.db
      .query("links")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .take(args.limit || 50);
  },
});
```

**That's it!** Web and iOS apps call `api.links.saveLink` and `api.links.listLinks`.

---

## Deployment

When you add new content types:

1. **Schema changes** - Convex deploys automatically when you save
2. **New functions** - Available immediately via `npx convex dev`
3. **Web UI** - Hot reloads automatically
4. **iOS app** - Just rebuild, functions are already live

No API versioning headaches - Convex handles it!
