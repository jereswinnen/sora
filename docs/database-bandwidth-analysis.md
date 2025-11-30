# Database Bandwidth Analysis

## What is Database Bandwidth?

In Convex, **database bandwidth** measures the amount of data transferred between your Convex functions and the underlying database. This includes:

- **Reads**: Data fetched from the database (queries, `.get()`, `.collect()`, filters)
- **Writes**: Data written to the database (inserts, patches, deletes)
- **Index scans**: Data read while traversing indexes to find matching documents

Every time a query fetches documents or a mutation writes data, you consume bandwidth. The cost is based on the **size of documents** transferred, not just the number of operations.

### Why It Matters

- Convex bills based on database bandwidth usage
- Excessive reads slow down your application
- Unbounded queries (`.collect()` without limits) can cause memory issues
- Inefficient patterns compound as your user base grows

---

## Current State of Your Project

### Overview

| Severity | Count | Description |
|----------|-------|-------------|
| Critical | 5 | Issues that scale poorly and need immediate attention |
| Moderate | 5 | Inefficiencies that add up over time |
| Good | 10+ | Well-optimized operations |

Your codebase is **generally well-structured**, but has several patterns that cause unnecessary database bandwidth consumption.

---

## Critical Issues

### 1. Tag Operation Multiplier Effect

**Location**: `saveArticleToDB`, `addBook`, `addBookmark` (and related mutations)

**Problem**: Every time you save content with tags, each tag triggers multiple database operations:

```
Per tag: normalizeAndCreateTag (1 read + 1 write) + incrementTagCount (1 read + 1 write)
```

**Real cost of saving an article with 5 tags**:
| Operation | Reads | Writes |
|-----------|-------|--------|
| Check article exists | 1 | 0 |
| Insert article | 0 | 1 |
| Tag normalization (×5) | 5 | 5 |
| Tag count increment (×5) | 5 | 5 |
| **Total** | **11** | **11** |

**Expected**: 2 operations (1 read, 1 write)
**Actual**: 22 operations

This pattern exists in `articles.ts:54`, `books.ts:8`, `bookmarks.ts:117`, and highlight mutations.

---

### 2. Hourly Feed Fetch Loads ALL Subscriptions

**Location**: `convex/feeds.ts:85` (`getAllSubscriptionsInternal`)

**Problem**: The cron job that fetches RSS feeds calls `.collect()` on the entire subscriptions table with no user filter:

```typescript
// Current: Loads EVERY subscription in the database
const subscriptions = await ctx.db.query("feedSubscriptions").collect();
```

**Impact**: If you have 100 users with 5 subscriptions each:
- 500 documents read every hour
- 12,000 documents read per day
- Scales linearly with users—completely unsustainable

---

### 3. `listUserHighlights` Has No Limit

**Location**: `convex/highlights.ts:167`

**Problem**: Uses `.collect()` without any limit, loading ALL highlights for a user:

```typescript
const allHighlights = await ctx.db
  .query("highlights")
  .withIndex("by_user", (q) => q.eq("userId", userId))
  .collect();  // No limit!
```

**Impact**: A user with 1,000 highlights would load all 1,000 documents on every page view that shows highlights.

---

### 4. `saveHighlights` Replace-All Pattern

**Location**: `convex/highlights.ts:9`

**Problem**: This function deletes ALL existing highlights for a content item and re-inserts them:

```typescript
// Loads all existing
const existingHighlights = await ctx.db
  .query("highlights")
  .withIndex("by_user_and_content", ...)
  .collect();

// Deletes all
for (const highlight of existingHighlights) {
  await ctx.db.delete(highlight._id);
}

// Inserts all new
for (const highlight of highlights) {
  await ctx.db.insert("highlights", {...});
}
```

**Impact**: Updating 100 highlights = 1 read + 100 deletes + 100 inserts = 201 operations

---

### 5. `debugListAllHighlights` Security & Performance Issue

**Location**: `convex/highlights.ts:190`

**Problem**: Public query with no authentication that loads the ENTIRE highlights table:

```typescript
export const debugListAllHighlights = query({
  handler: async (ctx) => {
    return await ctx.db.query("highlights").collect();  // ALL highlights, ALL users!
  },
});
```

**Impact**: Security vulnerability + unbounded read of entire table.

---

## Moderate Issues

### 6. List Queries Use Multipliers for Filtering

**Locations**:
- `listArticles` (`articles.ts:132`): fetches `limit * 3` documents
- `listBooks` (`books.ts:96`): fetches `limit * 2` documents
- `listBookmarks` (`bookmarks.ts:198`): fetches `limit * 2` documents

**Problem**: To account for in-memory tag filtering, these queries fetch 2-3x more documents than needed:

```typescript
// Getting 50 articles actually reads 150
const articles = await articlesQuery.take(limit * 3);
const filtered = articles.filter(a => a.tags?.includes(selectedTag));
return filtered.slice(0, limit);
```

**Impact**: 50-67% wasted reads on filtered queries.

---

### 7. Missing Compound Indexes for Duplicate Checks

**Locations**:
- `articles.ts:75`: checks URL uniqueness with filter
- `bookmarks.ts:141`: checks URL uniqueness with filter
- `books.ts:27`: checks title+author uniqueness with filter

**Problem**: These use `.filter()` after an index query, causing extra document scans:

```typescript
// Uses by_user index, then filters by URL (inefficient)
const existing = await ctx.db
  .query("articles")
  .withIndex("by_user", (q) => q.eq("userId", userId))
  .filter((q) => q.eq(q.field("url"), url))
  .first();
```

**Better**: A `by_user_url` compound index would make this a direct lookup.

---

### 8. `checkArticleExists` in Feed Fetch Loop

**Location**: `convex/feeds.ts:94`

**Problem**: Called up to 20 times per feed, per subscription, per hour—with inefficient filtering:

```typescript
// Called in a loop for every RSS item
const existing = await ctx.db
  .query("articles")
  .withIndex("by_user", (q) => q.eq("userId", userId))
  .filter((q) => q.eq(q.field("url"), url))
  .first();
```

**Impact**: With 100 users × 5 feeds × 20 items = 10,000 queries per hour, each doing a filter scan.

---

## What's Working Well

These patterns are efficient and don't need changes:

| Pattern | Location | Why It's Good |
|---------|----------|---------------|
| Single document fetches | `getArticle`, `getBook`, `getBookmark` | Direct ID lookup, minimal bandwidth |
| Auth token only | `viewer` in users.ts | No database access at all |
| External API actions | `searchBooks`, `fetchBookmarkMetadata` | No DB operations |
| Indexed tag lookups | `normalizeAndCreateTag` | Uses `by_user_name` index correctly |
| Excluding `content` in list | `listArticles` | Large field excluded from list view |

---

## Recommendations

### Priority 0: Urgent (Do First)

#### 1. Fix the Feed Fetch Cron

Instead of loading all subscriptions globally, process by user or paginate:

```typescript
// Option A: Process one user at a time (in cron scheduling)
// Option B: Add pagination to batch subscriptions
// Option C: Store lastProcessedAt and only fetch stale subscriptions
```

#### 2. Add Pagination to `listUserHighlights`

```typescript
// Add limit and cursor-based pagination
.take(limit)
// Return cursor for "load more"
```

#### 3. Remove or Secure `debugListAllHighlights`

Either delete this endpoint or add authentication + pagination.

#### 4. Add Compound Indexes

Add these to `convex/schema.ts`:

```typescript
// For duplicate URL checks
articles: defineTable({...})
  .index("by_user_url", ["userId", "url"]),

bookmarks: defineTable({...})
  .index("by_user_url", ["userId", "url"]),

// For book duplicate checks
books: defineTable({...})
  .index("by_user_title_author", ["userId", "title", "author"]),
```

### Priority 1: High Impact

#### 5. Batch Tag Operations

Instead of calling `normalizeAndCreateTag` in a loop, create a batch function:

```typescript
// Before: N calls for N tags
for (const tag of tags) {
  await normalizeAndCreateTag(ctx, { name: tag });
  await incrementTagCount(ctx, { name: tag });
}

// After: 1 call for N tags
await batchNormalizeAndCreateTags(ctx, { names: tags });
```

#### 6. Fix `saveHighlights` Pattern

Use upsert logic instead of delete-all-then-insert:

```typescript
// Compare existing vs new, only delete removed, only insert new
const toDelete = existing.filter(e => !newIds.includes(e.id));
const toInsert = newHighlights.filter(h => !existingIds.includes(h.id));
```

#### 7. Add Tag Index for Filtering

Instead of fetching 3x documents and filtering in memory:

```typescript
// Add a search index or denormalized tag field for efficient queries
```

### Priority 2: Nice to Have

- Add pagination to all `.collect()` calls
- Create monitoring for queries that return >100 documents
- Consider caching frequently-accessed data (like user preferences)

---

## Estimated Impact

Based on 100 users, 50 articles each, 5 feeds, 20 highlights:

| Metric | Current | After Fixes | Reduction |
|--------|---------|-------------|-----------|
| Save article (5 tags) | 22 ops | 4-6 ops | 73% |
| List articles (50) | 150 reads | 50 reads | 67% |
| Feed cron (hourly) | 500+ reads | 50-100 reads | 80-90% |
| Highlight operations | 200+ ops | 20-40 ops | 80% |
| **Daily total** | ~210k ops | ~15k ops | **93%** |

---

## Summary

Your project has solid fundamentals but a few patterns that don't scale well:

1. **Tag operations multiply reads/writes** - batch them
2. **Cron job reads entire table** - paginate or partition
3. **Some queries have no limits** - add pagination
4. **Missing compound indexes** - add them for common lookups
5. **Replace-all patterns** - use delta updates instead

The good news: most fixes are straightforward index additions and small refactors. The biggest wins come from fixing the feed cron and batching tag operations.
