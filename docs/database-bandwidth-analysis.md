# Database Bandwidth Analysis

> **Context**: This app is for personal use (1-2 users only). Despite low user count, you're hitting 1GB/month due to a specific issue with how article content is being read.

---

## Live Observations (Nov 30, 2024)

Analyzed Convex logs during a period with **zero user activity**. The hourly feed cron job shows the exact problem:

```
12:00:01  A  fetchAllFeeds           log  Fetching 1 feeds...
12:00:09  Q  checkArticleExists      success  11ms
12:00:09  Q  checkArticleExists      success  10ms
12:00:09  Q  checkArticleExists      success  11ms
... (20+ more calls in rapid succession)
12:00:10  Q  checkArticleExists      success  11ms
12:00:10  M  updateLastFetched       success  6ms
12:00:10  A  fetchSingleFeed         log  saved 0 new articles (skipped 0 older)
12:00:10  A  fetchAllFeeds           log  Feed fetch complete
```

**Key findings:**
- **~20 `checkArticleExists` calls per feed** - Each checking if a URL already exists
- **Each call takes 10-13ms** - Indicating a scan, not an index lookup
- **No user activity required** - This runs every hour automatically
- **1 feed = 20 calls** - With multiple feeds, this multiplies quickly

This confirms the cron job is the primary source of background bandwidth consumption.

## What is Database Bandwidth?

In Convex, **database bandwidth** measures the amount of data transferred between your Convex functions and the underlying database. This includes:

- **Reads**: Data fetched from the database (queries, `.get()`, `.collect()`, filters)
- **Writes**: Data written to the database (inserts, patches, deletes)
- **Index scans**: Data read while traversing indexes to find matching documents

**Critical point**: Bandwidth is charged when data is **read from the database**, not when it's returned to the client. If you read a 100KB document and only return the title, you still pay for 100KB.

---

## Root Cause: The `content` Field

Your `articles` table stores full HTML content (50-200KB per article). The problem is that **several queries read this field even when they don't need it**.

### The Smoking Gun: `listArticles`

```typescript
// articles.ts:161 - This reads FULL documents including content!
const articles = await query.take(fetchLimit);

// This exclusion happens AFTER the read - too late!
return filtered.slice(0, limit).map((article) => ({
  _id: article._id,
  title: article.title,
  // content is excluded here, but was already read above
}));
```

**The math**:
| Factor | Value |
|--------|-------|
| Articles fetched per query | 150 (limit × 3 for filtering) |
| Average `content` size | ~100KB |
| **Bandwidth per query** | **~15MB** |

With Convex's reactive system, this query re-runs when:
- Any article is added/modified/deleted
- Browser tab regains focus
- Network reconnects
- Page loads

**50-100 query runs × 15MB = 750MB - 1.5GB/month** ← This is your problem!

### Secondary Issue: `checkArticleExists`

```typescript
// feeds.ts:100-104
const article = await ctx.db
  .query("articles")
  .withIndex("by_user", (q) => q.eq("userId", args.userId))
  .filter((q) => q.eq(q.field("url"), args.url))  // Scans articles with content!
  .first();
```

This scans through articles (reading full content) until it finds a URL match. The cron job calls this ~20× per feed, per hour.

---

## The Fix: Don't Read What You Don't Need

Convex doesn't support field projection (selecting specific fields), so you have two options:

### Option 1: Separate the content into its own table (Recommended)

Split the `articles` table:

```
articles (small, frequently queried)     articleContent (large, rarely queried)
├── _id                                  ├── _id
├── userId                               ├── articleId (reference)
├── url                                  └── content (the big field)
├── title
├── excerpt
├── imageUrl
├── author
├── savedAt
├── tags
└── ... (small metadata)
```

**Why this works**:
- `listArticles` now reads small documents (~1-2KB each)
- `getArticle` does 2 reads but only when viewing a single article
- 150 articles × 2KB = 300KB per query (vs 15MB before) = **98% reduction**

### Option 2: Add a compound index for URL lookups

At minimum, add this index to eliminate content scanning in `checkArticleExists`:

```typescript
// In schema.ts, add to articles table:
.index("by_user_url", ["userId", "url"])
```

Then update the query:
```typescript
const article = await ctx.db
  .query("articles")
  .withIndex("by_user_url", (q) =>
    q.eq("userId", args.userId).eq("url", args.url)
  )
  .first();
```

This is a direct lookup—no scanning, no reading content of other articles.

---

## Recommended Actions

| Priority | Action | Effort | Impact |
|----------|--------|--------|--------|
| **P0** | Add `by_user_url` index | 5 min | Stops content scanning in feed checks |
| **P1** | Split content to separate table | 1-2 hours | **98% bandwidth reduction** |
| **P2** | Reduce cron frequency to every 4-8 hours | 1 min | Reduces background calls by 75-87% |

### Quick Win: The Index (Do This Now)

Add to `convex/schema.ts`:

```typescript
articles: defineTable({...})
  .index("by_user_url", ["userId", "url"])  // Add this line
```

Update `convex/feeds.ts` `checkArticleExists`:

```typescript
const article = await ctx.db
  .query("articles")
  .withIndex("by_user_url", (q) =>
    q.eq("userId", args.userId).eq("url", args.url)
  )
  .first();
```

### The Real Fix: Split Content Table

This requires more work but solves the root cause:

1. Create `articleContent` table with `articleId` + `content`
2. Modify `saveArticleToDB` to insert into both tables
3. Modify `listArticles` to query only the `articles` table (now small)
4. Modify `getArticle` to join with `articleContent`
5. Migrate existing data

---

## Why This Wasn't Obvious

The code *looks* efficient:

```typescript
// Appears to exclude content from the return
return articles.map(a => ({
  title: a.title,
  // content not included!
}));
```

But Convex (like most databases) reads entire documents. The exclusion happens in JavaScript after the database read. This is a common gotcha.

---

## Bandwidth Estimates After Fixes

| Scenario | Before | After Index | After Split |
|----------|--------|-------------|-------------|
| `listArticles` (150 articles) | 15MB | 15MB | 300KB |
| `checkArticleExists` (per call) | ~500KB | ~2KB | ~2KB |
| Feed cron (20 items × 1 feed × hourly) | ~10MB/day | ~40KB/day | ~40KB/day |
| Feed cron (with 4hr interval) | ~2.5MB/day | ~10KB/day | ~10KB/day |
| **Monthly total** | 1GB+ | ~500MB | **~50MB** |

---

## Summary

**Your bandwidth issue is caused by reading the `content` field when you don't need it.**

1. **Quick fix**: Add `by_user_url` index to stop content scanning in feed checks
2. **Real fix**: Split content into a separate table so `listArticles` doesn't read it
3. **Bonus**: Reduce cron frequency since you only have 1 feed and don't need hourly checks

The architecture pattern of "store large blobs separately" is common in document databases for exactly this reason.

---

## Next Steps

When ready to implement:

1. **Start with P0** - Add the index and update `checkArticleExists`. Deploy and monitor for a few days.
2. **Then P1** - Split the content table. This is the big win but requires a data migration.
3. **Optionally P2** - Adjust cron frequency based on how timely you need feed updates.
