# Follow Author Feature - Implementation Plan

**Status:** Planning Phase
**Created:** 2025-11-11
**Owner:** Product/Engineering

---

## Overview

The "Follow Author" feature enables users to subscribe to RSS/Atom feeds from publications and authors. When a user clicks "Follow Author" on an article, the app will:

1. Discover the publication's RSS feed
2. Subscribe the user to that feed
3. Periodically fetch new articles from subscribed feeds
4. Automatically add new articles to the user's library

This feature transforms Sora from a manual save-for-later tool into an automated content aggregator for trusted sources.

---

## Architecture Overview

### Core Components

```
User clicks "Follow" button
    ↓
[Feed Discovery Action] → Discovers RSS feed URL from article URL
    ↓
[Subscribe Mutation] → Creates feed + subscription record
    ↓
[Scheduled Cron Job] → Runs every hour
    ↓
[Fetch Feeds Action] → Fetches all active feeds
    ↓
[Parse Feed Action] → Extracts new articles
    ↓
[Auto-save Articles] → Reuses existing saveArticle logic
    ↓
[User's Article List] → New articles appear automatically
```

### Design Principles

✅ **Backend-heavy:** All feed fetching, parsing, and logic in Convex
✅ **Reuse existing code:** Leverage `saveArticle` action for parsing
✅ **Deduplication:** Never save the same article twice
✅ **User control:** Users can unfollow feeds anytime
✅ **Extensibility:** Schema supports future features (feed folders, per-feed settings)

---

## Database Schema Changes

### 1. New Table: `feeds`

Stores RSS/Atom feed metadata. Feeds are shared across users (many-to-many relationship).

```typescript
feeds: defineTable({
  // Feed identity
  feedUrl: v.string(), // Canonical RSS/Atom feed URL
  siteUrl: v.optional(v.string()), // Website homepage URL

  // Feed metadata (from RSS)
  title: v.string(), // Feed title (e.g., "The New York Times - Technology")
  description: v.optional(v.string()),
  imageUrl: v.optional(v.string()), // Feed logo/favicon
  author: v.optional(v.string()), // Publication/author name

  // Fetching metadata
  lastFetchedAt: v.optional(v.number()), // Last successful fetch timestamp
  lastPublishedAt: v.optional(v.number()), // Latest article publish date in feed
  nextFetchAt: v.optional(v.number()), // Scheduled next fetch (for backoff)
  fetchIntervalMinutes: v.number(), // How often to fetch (default: 60)

  // Error tracking
  consecutiveErrors: v.number(), // Count of consecutive fetch failures
  lastError: v.optional(v.string()), // Last error message

  // Feed health
  status: v.string(), // "active", "paused", "error", "archived"

  // Metadata
  createdAt: v.number(),
  updatedAt: v.number(),
})
  .index("by_url", ["feedUrl"]) // Unique feed lookup
  .index("by_next_fetch", ["status", "nextFetchAt"]) // Scheduled fetching
```

**Key Design Decisions:**

- **Shared feeds:** One feed record can have many subscribers (efficient)
- **Adaptive fetching:** `fetchIntervalMinutes` can increase with errors (backoff)
- **Health tracking:** `consecutiveErrors` helps identify broken feeds
- **Status field:** Allows pausing feeds without deleting subscriptions

### 2. New Table: `feedSubscriptions`

Links users to feeds they follow. This is the many-to-many relationship table.

```typescript
feedSubscriptions: defineTable({
  userId: v.string(), // Auth0 user ID from getUserIdentity().subject
  feedId: v.id("feeds"), // Reference to feeds table

  // Subscription metadata
  subscribedAt: v.number(),
  lastViewedAt: v.optional(v.number()), // Last time user viewed feed articles

  // User preferences (per-feed)
  autoSave: v.boolean(), // Auto-add articles to library (default: true)
  notifyNewArticles: v.optional(v.boolean()), // Future: push notifications

  // Tracking
  articlesAdded: v.number(), // Count of articles auto-saved from this feed

  // Metadata
  createdAt: v.number(),
})
  .index("by_user", ["userId"]) // List user's subscriptions
  .index("by_feed", ["feedId"]) // List feed's subscribers
  .index("by_user_feed", ["userId", "feedId"]) // Check if user follows feed
```

**Key Design Decisions:**

- **Per-feed settings:** Users can disable auto-save for specific feeds
- **Usage tracking:** `articlesAdded` shows feed value
- **Soft delete:** Remove subscription row to unfollow (keeps feed record)

### 3. New Table: `feedArticles` (Optional - Recommended)

Intermediate table to track which articles came from which feed. Prevents duplicate fetching.

```typescript
feedArticles: defineTable({
  feedId: v.id("feeds"),
  articleUrl: v.string(), // Canonical article URL
  articleGuid: v.optional(v.string()), // RSS <guid> for deduplication

  // Article metadata (from RSS)
  title: v.string(),
  publishedAt: v.optional(v.number()),

  // Processing status
  processedAt: v.number(), // When we first saw this article
  savedToUsersAt: v.optional(v.number()), // When we last processed subscriptions

  // Metadata
  createdAt: v.number(),
})
  .index("by_feed", ["feedId"]) // Articles from a specific feed
  .index("by_url", ["articleUrl"]) // Deduplication by URL
  .index("by_guid", ["feedId", "articleGuid"]) // Deduplication by GUID
```

**Why this table?**

✅ Prevents re-processing the same feed article multiple times
✅ Enables "show new articles since you subscribed" feature
✅ Allows multiple users to subscribe to same feed without duplicate work
✅ Tracks which articles were discovered but not saved (if user has autoSave=false)

**Alternative:** Skip this table and rely on URL deduplication in `articles` table. Simpler but less efficient.

---

## Convex Functions

### File: `convex/feeds.ts` (New)

All feed-related operations live here.

#### 1. **Action: `discoverFeed`**

Discovers RSS feed URL from an article URL.

```typescript
export const discoverFeed = action({
  args: {
    articleUrl: v.string()
  },
  handler: async (ctx, args) => {
    // 1. Fetch the article page HTML
    // 2. Look for RSS feed link in <head>:
    //    <link rel="alternate" type="application/rss+xml" href="...">
    //    <link rel="alternate" type="application/atom+xml" href="...">
    // 3. Check common feed URL patterns:
    //    - /feed
    //    - /rss
    //    - /atom
    //    - /feed.xml
    // 4. Validate discovered feed URL (fetch and check if valid RSS/Atom)
    // 5. Return feed metadata: { feedUrl, title, description, siteUrl }
  },
});
```

**Edge Cases:**
- Multiple feeds on one site (e.g., "All Articles" vs "Technology")
- No feed available → return null
- Invalid feed → return error message

**Libraries:**
- Use `cheerio` (already in project) to parse HTML
- RSS parsing: `rss-parser` NPM package (lightweight)

---

#### 2. **Mutation: `subscribeFeed`**

Subscribes user to a feed. Creates feed record if doesn't exist.

```typescript
export const subscribeFeed = mutation({
  args: {
    feedUrl: v.string(),
    feedTitle: v.optional(v.string()),
    feedDescription: v.optional(v.string()),
    siteUrl: v.optional(v.string()),
    autoSave: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    const userId = identity.subject;

    // 1. Check if feed already exists
    let feed = await ctx.db
      .query("feeds")
      .withIndex("by_url", (q) => q.eq("feedUrl", args.feedUrl))
      .first();

    // 2. Create feed record if new
    if (!feed) {
      const feedId = await ctx.db.insert("feeds", {
        feedUrl: args.feedUrl,
        siteUrl: args.siteUrl,
        title: args.feedTitle || "Unknown Feed",
        description: args.feedDescription,
        fetchIntervalMinutes: 60, // Default: hourly
        consecutiveErrors: 0,
        status: "active",
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
      feed = await ctx.db.get(feedId);
    }

    // 3. Check if user already subscribed
    const existingSubscription = await ctx.db
      .query("feedSubscriptions")
      .withIndex("by_user_feed", (q) =>
        q.eq("userId", userId).eq("feedId", feed._id)
      )
      .first();

    if (existingSubscription) {
      return { success: false, message: "Already subscribed" };
    }

    // 4. Create subscription
    await ctx.db.insert("feedSubscriptions", {
      userId,
      feedId: feed._id,
      subscribedAt: Date.now(),
      autoSave: args.autoSave ?? true,
      articlesAdded: 0,
      createdAt: Date.now(),
    });

    // 5. Trigger immediate feed fetch (schedule next cron run)
    await ctx.scheduler.runAfter(0, api.feeds.fetchAllFeeds);

    return { success: true, feedId: feed._id };
  },
});
```

**Key Features:**
- Idempotent: safe to call multiple times
- Creates feed if new (deduplication by URL)
- Immediate fetch on first subscription
- Per-user autoSave preference

---

#### 3. **Query: `listSubscriptions`**

Lists all feeds a user is subscribed to.

```typescript
export const listSubscriptions = query({
  args: {
    includeArchived: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    const userId = identity.subject;

    // Get user's subscriptions
    const subscriptions = await ctx.db
      .query("feedSubscriptions")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    // Join with feed data
    const feedsWithMeta = await Promise.all(
      subscriptions.map(async (sub) => {
        const feed = await ctx.db.get(sub.feedId);
        return {
          subscription: sub,
          feed: feed,
        };
      })
    );

    // Filter archived if needed
    if (!args.includeArchived) {
      return feedsWithMeta.filter((f) => f.feed?.status !== "archived");
    }

    return feedsWithMeta;
  },
});
```

---

#### 4. **Mutation: `unsubscribeFeed`**

Removes user's subscription to a feed.

```typescript
export const unsubscribeFeed = mutation({
  args: {
    feedId: v.id("feeds"),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    const userId = identity.subject;

    // Find and delete subscription
    const subscription = await ctx.db
      .query("feedSubscriptions")
      .withIndex("by_user_feed", (q) =>
        q.eq("userId", userId).eq("feedId", args.feedId)
      )
      .first();

    if (!subscription) {
      throw new Error("Subscription not found");
    }

    await ctx.db.delete(subscription._id);

    // Optional: Archive feed if no remaining subscribers
    const remainingSubscribers = await ctx.db
      .query("feedSubscriptions")
      .withIndex("by_feed", (q) => q.eq("feedId", args.feedId))
      .collect();

    if (remainingSubscribers.length === 0) {
      await ctx.db.patch(args.feedId, {
        status: "archived",
        updatedAt: Date.now(),
      });
    }

    return { success: true };
  },
});
```

---

#### 5. **Scheduled Function: `fetchAllFeeds`** (CRON)

Runs periodically to fetch new articles from all active feeds.

```typescript
export const fetchAllFeeds = internalAction({
  handler: async (ctx) => {
    const now = Date.now();

    // Get feeds that are due for fetching
    const feedsDue = await ctx.runQuery(api.feeds.getFeedsDueForFetch, {
      currentTime: now,
    });

    console.log(`Fetching ${feedsDue.length} feeds...`);

    // Fetch each feed (run in parallel for efficiency)
    await Promise.all(
      feedsDue.map(async (feed) => {
        try {
          await ctx.runAction(api.feeds.fetchFeed, {
            feedId: feed._id,
          });
        } catch (error) {
          console.error(`Error fetching feed ${feed.feedUrl}:`, error);
          // Continue with other feeds
        }
      })
    );
  },
});

// Convex cron schedule (in convex.config.ts or separate file)
// crons.hourly("fetch-feeds", { hourUtc: "*" }, api.feeds.fetchAllFeeds)
```

**Cron Configuration:**

In `convex/crons.ts` (new file):

```typescript
import { cronJobs } from "convex/server";
import { api } from "./_generated/api";

const crons = cronJobs();

// Fetch feeds every hour
crons.hourly(
  "fetch-feeds",
  { minuteUTC: 0 }, // Run at the top of every hour
  api.feeds.fetchAllFeeds
);

export default crons;
```

**Performance Consideration:**

- Start with hourly fetching
- Implement adaptive intervals (high-volume feeds → 30min, low-volume → 3hr)
- Batch feed fetches (process 10 feeds at a time)
- Timeout individual feed fetches (30s max)

---

#### 6. **Query: `getFeedsDueForFetch`** (Internal)

Returns feeds that should be fetched now.

```typescript
export const getFeedsDueForFetch = query({
  args: { currentTime: v.number() },
  handler: async (ctx, args) => {
    // Get active feeds where nextFetchAt <= currentTime
    const feeds = await ctx.db
      .query("feeds")
      .withIndex("by_next_fetch")
      .filter((q) =>
        q.and(
          q.eq(q.field("status"), "active"),
          q.lte(q.field("nextFetchAt"), args.currentTime)
        )
      )
      .collect();

    return feeds;
  },
});
```

---

#### 7. **Action: `fetchFeed`**

Fetches and processes a single feed.

```typescript
export const fetchFeed = internalAction({
  args: {
    feedId: v.id("feeds"),
  },
  handler: async (ctx, args) => {
    // 1. Get feed record
    const feed = await ctx.runQuery(api.feeds.getFeed, {
      feedId: args.feedId
    });

    if (!feed) throw new Error("Feed not found");

    try {
      // 2. Fetch RSS/Atom feed
      const response = await fetch(feed.feedUrl, {
        headers: {
          "User-Agent": "Sora/1.0 (RSS Reader)",
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const feedXml = await response.text();

      // 3. Parse feed XML
      const Parser = require("rss-parser");
      const parser = new Parser();
      const parsedFeed = await parser.parseString(feedXml);

      // 4. Process new articles
      const newArticles = parsedFeed.items.slice(0, 20); // Limit to 20 most recent

      for (const item of newArticles) {
        await ctx.runMutation(api.feeds.processArticleFromFeed, {
          feedId: args.feedId,
          articleUrl: item.link,
          articleGuid: item.guid,
          title: item.title,
          publishedAt: item.pubDate ? new Date(item.pubDate).getTime() : undefined,
        });
      }

      // 5. Update feed metadata (success)
      await ctx.runMutation(api.feeds.updateFeedMetadata, {
        feedId: args.feedId,
        lastFetchedAt: Date.now(),
        lastPublishedAt: newArticles[0]?.pubDate
          ? new Date(newArticles[0].pubDate).getTime()
          : undefined,
        consecutiveErrors: 0,
        lastError: undefined,
        nextFetchAt: Date.now() + feed.fetchIntervalMinutes * 60 * 1000,
      });

    } catch (error) {
      // 6. Update feed metadata (error)
      const consecutiveErrors = feed.consecutiveErrors + 1;
      const backoffMinutes = Math.min(feed.fetchIntervalMinutes * Math.pow(2, consecutiveErrors), 1440); // Max 24hr

      await ctx.runMutation(api.feeds.updateFeedMetadata, {
        feedId: args.feedId,
        consecutiveErrors,
        lastError: error.message,
        status: consecutiveErrors >= 5 ? "error" : "active", // Pause after 5 failures
        nextFetchAt: Date.now() + backoffMinutes * 60 * 1000,
      });

      throw error; // Re-throw for logging
    }
  },
});
```

**Error Handling:**

- **Exponential backoff:** 1hr → 2hr → 4hr → 8hr → 16hr → 24hr (max)
- **Auto-pause:** After 5 consecutive errors, mark feed as "error" status
- **Manual retry:** Users can manually retry errored feeds from UI

---

#### 8. **Mutation: `processArticleFromFeed`**

Processes a single article discovered in a feed.

```typescript
export const processArticleFromFeed = internalMutation({
  args: {
    feedId: v.id("feeds"),
    articleUrl: v.string(),
    articleGuid: v.optional(v.string()),
    title: v.string(),
    publishedAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    // 1. Check if we've already processed this article
    const existingFeedArticle = await ctx.db
      .query("feedArticles")
      .withIndex("by_url", (q) => q.eq("articleUrl", args.articleUrl))
      .first();

    if (existingFeedArticle) {
      return { alreadyProcessed: true };
    }

    // 2. Create feedArticles record
    const feedArticleId = await ctx.db.insert("feedArticles", {
      feedId: args.feedId,
      articleUrl: args.articleUrl,
      articleGuid: args.articleGuid,
      title: args.title,
      publishedAt: args.publishedAt,
      processedAt: Date.now(),
      createdAt: Date.now(),
    });

    // 3. Get all subscribers with autoSave enabled
    const subscribers = await ctx.db
      .query("feedSubscriptions")
      .withIndex("by_feed", (q) => q.eq("feedId", args.feedId))
      .filter((q) => q.eq(q.field("autoSave"), true))
      .collect();

    // 4. For each subscriber, check if they already have this article
    for (const subscription of subscribers) {
      // Check if user already has this article
      const existingUserArticle = await ctx.db
        .query("articles")
        .withIndex("by_user", (q) => q.eq("userId", subscription.userId))
        .filter((q) => q.eq(q.field("url"), args.articleUrl))
        .first();

      if (existingUserArticle) {
        continue; // Skip if user already has this article
      }

      // 5. Schedule article save (use existing saveArticle action)
      // Run as background task to avoid blocking
      await ctx.scheduler.runAfter(
        0,
        api.articles.saveArticle,
        {
          url: args.articleUrl,
          tags: ["from-feed"], // Optional: tag articles from feeds
        },
        {
          // Pass userId context somehow - this needs the Auth0 token
          // Alternative: create internal version of saveArticle that takes userId
        }
      );

      // 6. Increment articlesAdded counter
      await ctx.db.patch(subscription._id, {
        articlesAdded: subscription.articlesAdded + 1,
      });
    }

    // 7. Mark as saved
    await ctx.db.patch(feedArticleId, {
      savedToUsersAt: Date.now(),
    });

    return { saved: true, subscriberCount: subscribers.length };
  },
});
```

**Important: Authentication Challenge**

The `saveArticle` action requires an authenticated user context (Auth0 token). We have two options:

**Option A:** Create internal version `saveArticleForUser` mutation that takes `userId` parameter (bypasses auth check). Used only by scheduled jobs.

**Option B:** Store articles in a "pending" state and have client poll for new articles, then save them with user's auth token.

**Recommendation: Option A** - More efficient, but requires careful internal-only access control.

---

### File: `convex/articles.ts` (Modifications)

#### 9. **New Mutation: `saveArticleForUser`** (Internal)

Internal-only version of `saveArticle` for automated feed processing.

```typescript
export const saveArticleForUser = internalMutation({
  args: {
    userId: v.string(), // Passed directly, not from auth
    url: v.string(),
    title: v.string(),
    content: v.string(),
    excerpt: v.optional(v.string()),
    imageUrl: v.optional(v.string()),
    author: v.optional(v.string()),
    publishedAt: v.optional(v.number()),
    tags: v.optional(v.array(v.string())),
    readingTimeMinutes: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { userId, ...articleData } = args;

    // Check for duplicates
    const existing = await ctx.db
      .query("articles")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .filter((q) => q.eq(q.field("url"), articleData.url))
      .first();

    if (existing) {
      return { saved: false, reason: "duplicate", articleId: existing._id };
    }

    // Save article
    const articleId = await ctx.db.insert("articles", {
      userId,
      ...articleData,
      tags: articleData.tags || [],
      savedAt: Date.now(),
    });

    return { saved: true, articleId };
  },
});
```

**Security:** This mutation is `internalMutation` - can only be called from other Convex functions, not from client code.

---

## UI Components

### 1. **Follow Button Component**

**Location:** `src/components/FollowButton.tsx`

**Features:**
- Shows "Follow Author" button on article detail page
- On click: discovers feed, shows confirmation modal
- If multiple feeds found: show dropdown to select
- Loading states during discovery
- Success feedback: "Following The New York Times"

**Integration Points:**
- Add to article detail page
- Pass article URL as prop
- Calls `useAction(api.feeds.discoverFeed)`
- Calls `useMutation(api.feeds.subscribeFeed)`

---

### 2. **Feeds Management Page**

**Location:** `src/app/feeds/page.tsx`

**Features:**
- List all subscribed feeds
- Show feed metadata (title, description, logo)
- Show stats: articles added, last fetch time
- Toggle autoSave per feed
- Unfollow button
- Retry failed feeds
- "Add feed manually" button (enter RSS URL directly)

**Data:**
- `useQuery(api.feeds.listSubscriptions)`
- `useMutation(api.feeds.unsubscribeFeed)`
- `useMutation(api.feeds.updateSubscription)` (for autoSave toggle)

---

### 3. **Article Source Badge**

**Location:** `src/components/ArticleSourceBadge.tsx`

**Features:**
- Small badge on article cards: "From: The New York Times"
- Clicking badge filters to articles from that feed
- Optional: clicking badge goes to feed management

**Data:**
- Need to track article source in articles table (add `sourceType` and `sourceFeedId` fields)

---

## Edge Cases & Error Handling

### Feed Discovery Issues

| Issue | Solution |
|-------|----------|
| No RSS feed found | Show message: "This publication doesn't provide an RSS feed" |
| Multiple feeds available | Show dropdown: "All Articles", "Technology", "Opinion" |
| Feed URL is invalid | Validate during discovery, show error message |
| Feed URL changes | Store both original and canonical URLs, handle redirects |

### Feed Fetching Issues

| Issue | Solution |
|-------|----------|
| Feed is down (404, 500) | Exponential backoff, mark as "error" after 5 failures |
| Feed returns HTML instead of XML | Detect content-type, show error to user |
| Feed is malformed XML | Try multiple parsers, log error, mark feed as error |
| Feed has no new articles | Skip processing, update lastFetchedAt |
| Feed is very large (>10MB) | Limit fetch size, process first 50 items only |

### Duplicate Article Handling

| Issue | Solution |
|-------|----------|
| Same article URL in multiple feeds | Only save once, track all source feeds |
| Article URL changes (redirect) | Normalize URLs before comparison |
| Article updated by publisher | Optionally update existing article content |
| User manually saved article before auto-save | Skip auto-save, don't create duplicate |

### Performance & Scale

| Issue | Solution |
|-------|----------|
| 100+ feeds to fetch hourly | Batch process 10 at a time, stagger cron runs |
| Feed fetch takes >30s | Set timeout, mark as slow, increase interval |
| User subscribes to 50+ feeds | Limit subscriptions per user (e.g., 20 max) |
| Feed publishes 100 articles/day | Limit processing to 20 most recent per fetch |

---

## Performance Optimizations

### 1. **Conditional Fetching**

Only fetch feed if `If-Modified-Since` header indicates new content.

```typescript
const response = await fetch(feed.feedUrl, {
  headers: {
    "If-Modified-Since": feed.lastFetchedAt
      ? new Date(feed.lastFetchedAt).toUTCString()
      : "",
  },
});

if (response.status === 304) {
  // Not modified, skip parsing
  return { unchanged: true };
}
```

### 2. **Parallel Processing**

Fetch multiple feeds in parallel (limit concurrency to 10).

```typescript
// Process in batches of 10
for (let i = 0; i < feedsDue.length; i += 10) {
  const batch = feedsDue.slice(i, i + 10);
  await Promise.all(batch.map(feed => fetchFeed(feed)));
}
```

### 3. **Incremental Article Processing**

Only process articles published after user's subscription date.

```typescript
const subscription = await getSubscription(userId, feedId);
const articlesToProcess = feedItems.filter(item =>
  new Date(item.pubDate).getTime() > subscription.subscribedAt
);
```

### 4. **Database Indexes**

Critical indexes for performance:

- `feeds.by_next_fetch` - Fast lookup of feeds due for fetching
- `feedArticles.by_url` - Fast duplicate detection
- `feedSubscriptions.by_user_feed` - Fast subscription checks

---

## Future Extensions

### Phase 2 Features

1. **Feed Folders/Collections**
   - Organize feeds into categories
   - Schema: `feedFolders` table with `feedId` → `folderId` mapping

2. **Per-Feed Settings**
   - Custom fetch intervals
   - Custom tags applied to all articles
   - Filter by keywords (only save articles matching keywords)

3. **Feed Analytics**
   - Articles per week chart
   - Most active feeds
   - Reading completion rate per feed

4. **Smart Filtering**
   - ML-based article scoring
   - Auto-archive low-quality articles
   - Suggest feeds based on reading history

5. **OPML Import/Export**
   - Import feeds from other RSS readers
   - Export subscription list
   - Standard format: `<outline type="rss" xmlUrl="..." />`

6. **Email Digests**
   - Daily/weekly email of new articles
   - Customizable digest format
   - Convex scheduled function sends via SendGrid/Postmark

### iOS Integration

All Convex functions work identically on iOS:

```swift
// Subscribe to feed
try await client.mutation("feeds:subscribeFeed", [
    "feedUrl": feedUrl,
    "feedTitle": feedTitle,
    "autoSave": true
])

// List subscriptions
let subscriptions = try await client.query("feeds:listSubscriptions")
```

No additional backend work needed - feeds sync instantly across web and iOS.

---

## Testing Strategy

### Unit Tests (Convex Functions)

Test feed parsing, deduplication, error handling:

```typescript
// Test: Feed discovery finds correct RSS URL
// Test: Duplicate articles are skipped
// Test: Failed feeds trigger backoff
// Test: Unsubscribe removes subscription but keeps feed
```

### Integration Tests

1. Subscribe to real RSS feed (e.g., NASA RSS)
2. Trigger manual feed fetch
3. Verify articles appear in user's library
4. Unsubscribe and verify no new articles added

### Load Testing

- Simulate 1000 users with 10 feeds each
- Trigger hourly cron job
- Measure: function execution time, database queries, errors

---

## Dependencies

### New NPM Packages

```json
{
  "dependencies": {
    "rss-parser": "^3.13.0", // RSS/Atom feed parsing
    "feedparser": "^2.2.10"  // Alternative parser (if needed)
  }
}
```

Both packages work in Convex actions (Node.js environment).

### Convex Configuration

Add cron schedule in `convex/crons.ts`:

```typescript
import { cronJobs } from "convex/server";
import { api } from "./_generated/api";

const crons = cronJobs();

crons.hourly(
  "fetch-feeds",
  { minuteUTC: 0 },
  api.feeds.fetchAllFeeds
);

export default crons;
```

---

## Implementation Checklist

### Phase 1: Core Functionality (MVP)

- [ ] Add schema tables: `feeds`, `feedSubscriptions`, `feedArticles`
- [ ] Implement `convex/feeds.ts`:
  - [ ] `discoverFeed` action
  - [ ] `subscribeFeed` mutation
  - [ ] `unsubscribeFeed` mutation
  - [ ] `listSubscriptions` query
  - [ ] `fetchFeed` action
  - [ ] `processArticleFromFeed` mutation
  - [ ] `fetchAllFeeds` scheduled action
- [ ] Implement `convex/articles.ts`:
  - [ ] `saveArticleForUser` internal mutation
- [ ] Add cron job configuration
- [ ] Build UI:
  - [ ] `FollowButton` component
  - [ ] Feeds management page (`/feeds`)
  - [ ] Feed subscription modal
- [ ] Testing:
  - [ ] Test feed discovery
  - [ ] Test subscription flow
  - [ ] Test article auto-save
  - [ ] Test error handling

### Phase 2: Polish & Optimization

- [ ] Add feed health monitoring dashboard
- [ ] Implement adaptive fetch intervals
- [ ] Add "source feed" badges on articles
- [ ] Add feed-based filtering in article list
- [ ] OPML import/export
- [ ] Per-feed custom settings UI

### Phase 3: Advanced Features

- [ ] Feed folders/collections
- [ ] Smart filtering (ML-based)
- [ ] Email digests
- [ ] Push notifications for new articles
- [ ] Feed recommendations

---

## Open Questions

1. **Article Source Tracking:**
   Should we add `sourceFeedId` to the `articles` table to track which feed an article came from?
   **Recommendation:** Yes - enables "show all articles from this source" feature.

2. **Feed Ownership:**
   Should feeds have an "owner" user (who discovered it) or be truly shared?
   **Recommendation:** Shared feeds, no ownership - simpler model.

3. **Auto-save Defaults:**
   Should new subscriptions default to `autoSave: true` or ask user?
   **Recommendation:** Default to `true`, allow toggling after subscription.

4. **Feed Refresh:**
   Should users be able to manually trigger "fetch now" for a specific feed?
   **Recommendation:** Yes - add "Refresh" button on feeds page.

5. **Article Limits:**
   Should we limit total articles per user to prevent database bloat?
   **Recommendation:** Phase 2 concern - add auto-archiving of old articles.

---

## Summary

This plan provides a comprehensive, production-ready approach to building the "Follow Author" feature:

✅ **Backend-heavy:** All logic in Convex (web + iOS compatible)
✅ **Efficient:** Shared feeds, deduplication, adaptive fetching
✅ **Scalable:** Cron jobs, batching, exponential backoff
✅ **User-friendly:** Auto-save, feed management UI, error recovery
✅ **Extensible:** Clear path to folders, filtering, analytics

**Estimated Development Time:**
- Phase 1 (MVP): 3-4 days
- Phase 2 (Polish): 2-3 days
- Phase 3 (Advanced): 5-7 days

**Next Steps:**
1. Review and approve this plan
2. Create implementation tasks
3. Start with schema + core Convex functions
4. Build UI once backend is stable
5. Test with real RSS feeds
6. Deploy and iterate based on usage

---

**Questions or feedback?** Let's discuss any concerns before implementation begins.
