# Database Bandwidth Analysis

> **Context**: This app is for personal use (1-2 users only). This significantly changes which optimizations are worth pursuing.

## What is Database Bandwidth?

In Convex, **database bandwidth** measures the amount of data transferred between your Convex functions and the underlying database. This includes:

- **Reads**: Data fetched from the database (queries, `.get()`, `.collect()`, filters)
- **Writes**: Data written to the database (inserts, patches, deletes)
- **Index scans**: Data read while traversing indexes to find matching documents

Every time a query fetches documents or a mutation writes data, you consume bandwidth. The cost is based on the **size of documents** transferred, not just the number of operations.

### Why It Matters (For Multi-User Apps)

- Convex bills based on database bandwidth usage
- Excessive reads slow down your application
- Unbounded queries (`.collect()` without limits) can cause memory issues
- Inefficient patterns compound as your user base grows

### Why Most of This Doesn't Matter (For 1-2 Users)

With a single-user app, the scale changes everything:
- You'll likely have <500 articles, <100 highlights, <20 feed subscriptions
- Even "inefficient" queries read trivial amounts of data
- Convex free tier handles personal use easily
- Query speed is imperceptible at this scale

---

## Current State: Reassessed for Personal Use

### Overview

| Original Severity | Reassessed | Count | Notes |
|-------------------|------------|-------|-------|
| Critical | **Non-issue** | 4 | Scale too small to matter |
| Critical | **Low priority** | 1 | Security hygiene (debug endpoint) |
| Moderate | **Non-issue** | 5 | Negligible at this scale |

**Your codebase is fine for personal use.** The patterns I originally flagged as "critical" only matter at scale (100+ users).

---

## What Actually Matters (Personal Use)

### 1. Remove `debugListAllHighlights` (Security Hygiene)

**Location**: `convex/highlights.ts:190`

**Why it still matters**: Even for personal use, having an unauthenticated endpoint that exposes all data is bad practice. If your Convex deployment URL leaks, anyone could read your highlights.

```typescript
// Current: No auth, exposes everything
export const debugListAllHighlights = query({
  handler: async (ctx) => {
    return await ctx.db.query("highlights").collect();
  },
});
```

**Fix**: Delete it or add authentication.

**Effort**: 2 minutes

---

### 2. Change Feed Cron to 8 Hours (Optional)

**Location**: `convex/crons.ts` (or wherever the cron is defined)

**Why**: Not for performance—just because checking RSS feeds hourly is overkill for personal use. Most blogs don't post more than once a day.

**Current impact with 1-2 users**:
- ~10-20 subscriptions × 24 checks/day = 240-480 operations/day
- This is **completely fine** and well within free tier

**With 8-hour interval**:
- ~10-20 subscriptions × 3 checks/day = 30-60 operations/day
- Saves a tiny amount, but more importantly matches actual need

**Effort**: 1 minute (change interval value)

---

### 3. Add Compound Indexes (Good Practice)

**Location**: `convex/schema.ts`

**Why**: Even at small scale, these make queries cleaner and slightly faster. They're trivial to add and good habits.

```typescript
// Add to articles table
.index("by_user_url", ["userId", "url"])

// Add to bookmarks table
.index("by_user_url", ["userId", "url"])

// Add to books table
.index("by_user_title_author", ["userId", "title", "author"])
```

**Effort**: 5 minutes

---

## What Doesn't Matter (At Your Scale)

### Tag Operation Multiplier

**Original concern**: Saving article with 5 tags = 22 operations instead of 2.

**Reality for 1-2 users**: Even if you save 10 articles/day with 5 tags each, that's 220 operations/day. Convex free tier allows millions. **Non-issue.**

### Feed Cron Reading All Subscriptions

**Original concern**: `.collect()` reads entire subscriptions table.

**Reality for 1-2 users**: With 10-20 subscriptions, this reads 10-20 small documents. **Non-issue.**

### `listUserHighlights` Unbounded

**Original concern**: No limit on `.collect()`.

**Reality for 1-2 users**: Even with 500 highlights, loading them all is fast and cheap. **Non-issue.**

### `saveHighlights` Replace-All Pattern

**Original concern**: Deletes all + re-inserts all highlights.

**Reality for 1-2 users**: Even replacing 50 highlights = 101 operations. Happens rarely. **Non-issue.**

### List Query Multipliers

**Original concern**: Fetching 150 documents to return 50.

**Reality for 1-2 users**: Reading 150 small article metadata records is trivial. **Non-issue.**

### Missing Compound Indexes for Duplicate Checks

**Original concern**: Filter scans after index lookup.

**Reality for 1-2 users**: Scanning 200 articles to find a URL match takes milliseconds. **Non-issue** (though still nice to fix).

---

## Recommended Actions (Personal Use)

| Action | Priority | Effort | Reason |
|--------|----------|--------|--------|
| Delete `debugListAllHighlights` | **Do it** | 2 min | Security hygiene |
| Add compound indexes | **Nice to have** | 5 min | Good practice, trivial effort |
| Change cron to 8 hours | **Optional** | 1 min | Matches actual need |
| Everything else | **Skip** | - | Not worth the effort at this scale |

---

## When Would Optimizations Matter?

These patterns would become actual problems if:

- You had **100+ users** (tag multiplier, cron queries)
- You accumulated **10,000+ highlights** (unbounded queries)
- You saved **50+ articles per day** (tag operations)
- You had **100+ feed subscriptions** (cron load)

For personal use with 1-2 users, you'd need years of heavy use to hit any limits.

---

## Summary

**Your codebase is well-structured for a personal app.** The original analysis identified patterns that don't scale well, but at 1-2 users, "scaling" isn't a concern.

**Do these** (10 minutes total):
1. Delete the debug endpoint (security)
2. Add compound indexes (good practice)
3. Optionally change cron to 8 hours (matches need)

**Skip everything else** — the effort isn't worth it for the negligible benefit at your scale.

---

## Appendix: Original Analysis (For Reference)

The patterns below were originally flagged but are **not worth fixing** for personal use:

<details>
<summary>Tag Operation Details</summary>

Every content save with tags triggers:
- `normalizeAndCreateTag`: 1 read + 1 write per tag
- `incrementTagCount`: 1 read + 1 write per tag

Article with 5 tags = 22 total operations. At scale this compounds; for 1-2 users it's negligible.
</details>

<details>
<summary>Query Multiplier Details</summary>

- `listArticles`: fetches `limit * 3` documents
- `listBooks`: fetches `limit * 2` documents
- `listBookmarks`: fetches `limit * 2` documents

This over-fetching accounts for in-memory tag filtering. At scale it wastes bandwidth; for 1-2 users the extra reads are imperceptible.
</details>

<details>
<summary>Feed Cron Details</summary>

`getAllSubscriptionsInternal` uses `.collect()` on entire table. For 100+ users this is expensive; for 1-2 users with 10-20 subscriptions it's trivial.
</details>
