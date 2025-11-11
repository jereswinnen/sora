# Follow Author Feature - Implementation Plan

**Status:** Planning Phase
**Created:** 2025-11-11
**Type:** Personal use (simplified architecture)

---

## Overview

Click "Follow Author" on any article → app automatically discovers the RSS feed → hourly cron fetches new articles → articles appear in your library, fully parsed.

Simple, automated content aggregation for trusted sources.

---

## Core Flow

```
User clicks "Follow Author" button
    ↓
[discoverAndSubscribeFeed] → Finds RSS feed from article domain
    ↓
[Save subscription] → Store feed URL in database
    ↓
[Hourly cron job] → Fetch all subscribed feeds
    ↓
[Parse RSS items] → Extract article URLs
    ↓
[Check for duplicates] → Query articles table by URL
    ↓
[Auto-save new articles] → Use existing saveArticle + parser
    ↓
Articles appear in library ✨
```

---

## Database Schema

### Single Table: `feedSubscriptions`

```typescript
feedSubscriptions: defineTable({
  userId: v.string(),              // Auth0 user ID
  feedUrl: v.string(),             // RSS/Atom feed URL
  feedTitle: v.string(),           // Display name (e.g., "The New York Times")
  siteUrl: v.optional(v.string()), // Homepage URL
  lastFetchedAt: v.optional(v.number()), // Last successful fetch
  subscribedAt: v.number(),        // When user subscribed
})
  .index("by_user", ["userId"])
```

**That's it.** No separate feeds table (you're the only user), no feedArticles table (just check `articles` for duplicates).

---

## Convex Functions

### File: `convex/feeds.ts` (New)

#### 1. **Action: `discoverAndSubscribeFeed`**

One-step subscribe: discovers feed + creates subscription.

```typescript
export const discoverAndSubscribeFeed = action({
  args: {
    articleUrl: v.string(),
  },
  handler: async (ctx, args) => {
    // 1. Fetch article page HTML
    const response = await fetch(args.articleUrl);
    const html = await response.text();

    // 2. Parse HTML to find RSS feed link
    const cheerio = require("cheerio");
    const $ = cheerio.load(html);

    // Look for RSS/Atom links in <head>
    let feedUrl = null;
    let feedTitle = null;

    $('link[type="application/rss+xml"], link[type="application/atom+xml"]').each((i, elem) => {
      if (!feedUrl) {
        feedUrl = $(elem).attr('href');
        feedTitle = $(elem).attr('title') || "RSS Feed";
      }
    });

    // 3. Try common patterns if no link found
    if (!feedUrl) {
      const urlObj = new URL(args.articleUrl);
      const baseUrl = `${urlObj.protocol}//${urlObj.host}`;

      const patterns = ['/feed', '/rss', '/atom', '/feed.xml', '/rss.xml'];

      for (const pattern of patterns) {
        try {
          const testUrl = `${baseUrl}${pattern}`;
          const testResponse = await fetch(testUrl);
          if (testResponse.ok && testResponse.headers.get('content-type')?.includes('xml')) {
            feedUrl = testUrl;
            feedTitle = urlObj.host;
            break;
          }
        } catch (e) {
          continue;
        }
      }
    }

    if (!feedUrl) {
      throw new Error("No RSS feed found for this site");
    }

    // 4. Make feed URL absolute
    if (feedUrl.startsWith('/')) {
      const urlObj = new URL(args.articleUrl);
      feedUrl = `${urlObj.protocol}//${urlObj.host}${feedUrl}`;
    }

    // 5. Validate feed by fetching and parsing it
    const Parser = require('rss-parser');
    const parser = new Parser();
    const feedResponse = await fetch(feedUrl);
    const feedXml = await feedResponse.text();
    const parsedFeed = await parser.parseString(feedXml);

    // 6. Create subscription
    await ctx.runMutation(api.feeds.createSubscription, {
      feedUrl,
      feedTitle: parsedFeed.title || feedTitle,
      siteUrl: parsedFeed.link || new URL(args.articleUrl).origin,
    });

    // 7. Trigger immediate fetch
    await ctx.scheduler.runAfter(0, api.feeds.fetchAllFeeds);

    return {
      success: true,
      feedUrl,
      feedTitle: parsedFeed.title || feedTitle,
    };
  },
});
```

---

#### 2. **Mutation: `createSubscription`**

Internal mutation called by discoverAndSubscribeFeed.

```typescript
export const createSubscription = mutation({
  args: {
    feedUrl: v.string(),
    feedTitle: v.string(),
    siteUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    const userId = identity.subject;

    // Check if already subscribed
    const existing = await ctx.db
      .query("feedSubscriptions")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .filter((q) => q.eq(q.field("feedUrl"), args.feedUrl))
      .first();

    if (existing) {
      throw new Error("Already subscribed to this feed");
    }

    // Create subscription
    await ctx.db.insert("feedSubscriptions", {
      userId,
      feedUrl: args.feedUrl,
      feedTitle: args.feedTitle,
      siteUrl: args.siteUrl,
      subscribedAt: Date.now(),
    });

    return { success: true };
  },
});
```

---

#### 3. **Query: `listSubscriptions`**

Get all user's subscribed feeds.

```typescript
export const listSubscriptions = query({
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    const userId = identity.subject;

    return await ctx.db
      .query("feedSubscriptions")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .collect();
  },
});
```

---

#### 4. **Mutation: `unsubscribeFeed`**

Remove a feed subscription.

```typescript
export const unsubscribeFeed = mutation({
  args: {
    subscriptionId: v.id("feedSubscriptions"),
  },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.subscriptionId);
    return { success: true };
  },
});
```

---

#### 5. **Scheduled Action: `fetchAllFeeds`** (CRON)

Runs every hour to fetch all subscribed feeds.

```typescript
export const fetchAllFeeds = internalAction({
  handler: async (ctx) => {
    // Get all subscriptions
    const subscriptions = await ctx.runQuery(api.feeds.getAllSubscriptionsInternal);

    console.log(`Fetching ${subscriptions.length} feeds...`);

    // Fetch each feed
    for (const sub of subscriptions) {
      try {
        await ctx.runAction(api.feeds.fetchSingleFeed, {
          subscriptionId: sub._id,
          feedUrl: sub.feedUrl,
          userId: sub.userId,
        });
      } catch (error) {
        console.error(`Error fetching feed ${sub.feedUrl}:`, error);
        // Continue with other feeds
      }
    }

    console.log("Feed fetch complete");
  },
});
```

---

#### 6. **Query: `getAllSubscriptionsInternal`** (Internal)

Helper for cron job.

```typescript
export const getAllSubscriptionsInternal = internalQuery({
  handler: async (ctx) => {
    return await ctx.db.query("feedSubscriptions").collect();
  },
});
```

---

#### 7. **Action: `fetchSingleFeed`**

Fetches one feed and saves new articles.

```typescript
export const fetchSingleFeed = internalAction({
  args: {
    subscriptionId: v.id("feedSubscriptions"),
    feedUrl: v.string(),
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    // 1. Fetch RSS feed
    const response = await fetch(args.feedUrl, {
      headers: {
        "User-Agent": "Sora/1.0 (RSS Reader)",
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const feedXml = await response.text();

    // 2. Parse feed
    const Parser = require('rss-parser');
    const parser = new Parser();
    const feed = await parser.parseString(feedXml);

    // 3. Process each article (limit to 20 most recent)
    const items = feed.items.slice(0, 20);
    let savedCount = 0;

    for (const item of items) {
      if (!item.link) continue;

      // Check if article already exists
      const existing = await ctx.runQuery(api.feeds.checkArticleExists, {
        userId: args.userId,
        url: item.link,
      });

      if (existing) {
        continue; // Skip duplicates
      }

      // Save article using existing action
      try {
        await ctx.runAction(api.articles.saveArticleForUserInternal, {
          userId: args.userId,
          url: item.link,
        });
        savedCount++;
      } catch (error) {
        console.error(`Failed to save article ${item.link}:`, error);
      }
    }

    // 4. Update lastFetchedAt
    await ctx.runMutation(api.feeds.updateLastFetched, {
      subscriptionId: args.subscriptionId,
    });

    console.log(`Feed ${args.feedUrl}: saved ${savedCount} new articles`);
  },
});
```

---

#### 8. **Query: `checkArticleExists`**

Check if user already has this article.

```typescript
export const checkArticleExists = internalQuery({
  args: {
    userId: v.string(),
    url: v.string(),
  },
  handler: async (ctx, args) => {
    const article = await ctx.db
      .query("articles")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .filter((q) => q.eq(q.field("url"), args.url))
      .first();

    return !!article;
  },
});
```

---

#### 9. **Mutation: `updateLastFetched`**

Update subscription's lastFetchedAt timestamp.

```typescript
export const updateLastFetched = internalMutation({
  args: {
    subscriptionId: v.id("feedSubscriptions"),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.subscriptionId, {
      lastFetchedAt: Date.now(),
    });
  },
});
```

---

### File: `convex/articles.ts` (Modifications)

#### 10. **Action: `saveArticleForUserInternal`**

Internal version of saveArticle for automated feed processing. Wraps the existing saveArticle logic.

```typescript
export const saveArticleForUserInternal = internalAction({
  args: {
    userId: v.string(),
    url: v.string(),
  },
  handler: async (ctx, args) => {
    // Fetch and parse article (reuse existing parser logic)
    const parsedArticle = await ctx.runAction(api.parser.parseArticle, {
      url: args.url,
    });

    // Save to database
    await ctx.runMutation(api.articles.saveArticleToDB, {
      userId: args.userId,
      url: args.url,
      title: parsedArticle.title,
      content: parsedArticle.content,
      excerpt: parsedArticle.excerpt,
      imageUrl: parsedArticle.imageUrl,
      author: parsedArticle.author,
      publishedAt: parsedArticle.publishedAt,
      readingTimeMinutes: parsedArticle.readingTimeMinutes,
      tags: [], // No tags for auto-saved articles
    });

    return { success: true };
  },
});
```

**Note:** You'll need to refactor existing `saveArticle` to extract the parsing logic, or duplicate it here. The key is reusing your existing Cheerio-based parser.

---

### File: `convex/crons.ts` (New)

Configure hourly cron job.

```typescript
import { cronJobs } from "convex/server";
import { api } from "./_generated/api";

const crons = cronJobs();

// Fetch all feeds every hour
crons.hourly(
  "fetch-feeds",
  { minuteUTC: 0 }, // Run at the top of every hour (XX:00)
  api.feeds.fetchAllFeeds
);

export default crons;
```

---

## UI Components

### 1. **Follow Button**

**Location:** Article detail page (wherever you view a single article)

**Component:** `src/components/FollowButton.tsx`

```typescript
"use client";

import { useState } from "react";
import { useAction } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Button } from "./ui/button";

export function FollowButton({ articleUrl }: { articleUrl: string }) {
  const [isLoading, setIsLoading] = useState(false);
  const discoverAndSubscribe = useAction(api.feeds.discoverAndSubscribeFeed);

  const handleFollow = async () => {
    setIsLoading(true);
    try {
      const result = await discoverAndSubscribe({ articleUrl });
      alert(`Now following: ${result.feedTitle}`);
    } catch (error) {
      alert(error.message || "Failed to find RSS feed");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Button onClick={handleFollow} disabled={isLoading}>
      {isLoading ? "Discovering feed..." : "Follow Author"}
    </Button>
  );
}
```

---

### 2. **Feeds Management Page**

**Location:** `src/app/settings/feeds/page.tsx` (or wherever settings are)

**Features:**
- List all subscribed feeds
- Show last fetched time
- Unfollow button

```typescript
"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";

export default function FeedsPage() {
  const subscriptions = useQuery(api.feeds.listSubscriptions);
  const unsubscribe = useMutation(api.feeds.unsubscribeFeed);

  if (!subscriptions) return <div>Loading...</div>;

  return (
    <div>
      <h1>Followed Feeds</h1>
      {subscriptions.length === 0 && <p>No feeds yet. Click "Follow Author" on any article!</p>}

      {subscriptions.map((sub) => (
        <div key={sub._id} className="flex items-center justify-between p-4 border-b">
          <div>
            <h3>{sub.feedTitle}</h3>
            <p className="text-sm text-gray-500">
              {sub.siteUrl}
            </p>
            {sub.lastFetchedAt && (
              <p className="text-xs text-gray-400">
                Last updated: {new Date(sub.lastFetchedAt).toLocaleString()}
              </p>
            )}
          </div>
          <button
            onClick={() => unsubscribe({ subscriptionId: sub._id })}
            className="text-red-500"
          >
            Unfollow
          </button>
        </div>
      ))}
    </div>
  );
}
```

---

## Edge Cases & Error Handling

### Feed Discovery

| Issue | Solution |
|-------|----------|
| No RSS feed found | Show error: "This site doesn't have an RSS feed" |
| Multiple feeds available | Just pick the first one (keep it simple) |
| Feed URL is relative | Convert to absolute using article's origin |
| Feed requires authentication | Won't work - show error |

### Feed Fetching

| Issue | Solution |
|-------|----------|
| Feed is down (404, 500) | Log error, skip, try again next hour |
| Feed returns invalid XML | Log error, skip |
| Feed has no new articles | Normal - update lastFetchedAt and continue |
| Article parsing fails | Log error, skip that article, continue with others |

### Duplicates

| Issue | Solution |
|-------|----------|
| Article URL already in library | Simple check - skip if exists |
| User manually saved article before auto-save | Same check catches this |
| Article URL has query params | Parse as-is (exact match) |

**Keep it simple:** No exponential backoff, no error tracking, no status fields. Just log and retry next hour.

---

## Dependencies

### NPM Packages

```bash
npm install rss-parser
```

That's it! `cheerio` is already in the project for article parsing.

---

## Implementation Checklist

### Phase 1: MVP (1-2 days)

- [ ] **Schema:**
  - [ ] Add `feedSubscriptions` table to `convex/schema.ts`

- [ ] **Backend (`convex/feeds.ts`):**
  - [ ] `discoverAndSubscribeFeed` action
  - [ ] `createSubscription` mutation
  - [ ] `listSubscriptions` query
  - [ ] `unsubscribeFeed` mutation
  - [ ] `fetchAllFeeds` scheduled action
  - [ ] `fetchSingleFeed` action
  - [ ] `checkArticleExists` query
  - [ ] `updateLastFetched` mutation
  - [ ] `getAllSubscriptionsInternal` query

- [ ] **Backend (`convex/articles.ts`):**
  - [ ] `saveArticleForUserInternal` action (reuse existing parser)

- [ ] **Cron:**
  - [ ] Create `convex/crons.ts` with hourly job

- [ ] **UI:**
  - [ ] `FollowButton` component
  - [ ] Add button to article detail page
  - [ ] Feeds management page

- [ ] **Testing:**
  - [ ] Test feed discovery on various sites
  - [ ] Subscribe to a feed, trigger manual fetch
  - [ ] Verify articles appear in library
  - [ ] Test unsubscribe

### Phase 2: Polish (Optional)

- [ ] Add loading states / better error messages
- [ ] Show "Following" state if already subscribed to feed
- [ ] Add feed favicon/logo
- [ ] Manual "Fetch Now" button for specific feed
- [ ] Show count of articles from each feed

---

## Testing

### Manual Testing Flow

1. **Find a test RSS feed:**
   - Try: `https://www.nasa.gov/news-release/feed/` (NASA news)
   - Or any blog with RSS

2. **Subscribe flow:**
   - Open any article from that site
   - Click "Follow Author"
   - Check subscriptions list

3. **Trigger fetch:**
   - Wait for hourly cron, OR
   - Manually call `ctx.scheduler.runAfter(0, api.feeds.fetchAllFeeds)` from Convex dashboard

4. **Verify articles:**
   - Check articles table in Convex dashboard
   - Should see new articles with URLs from the feed

5. **Test deduplication:**
   - Run fetch again
   - Verify no duplicate articles created

6. **Unsubscribe:**
   - Remove feed from management page
   - Verify subscription deleted

---

## Summary

**Super simple architecture:**
- 1 database table
- 4 user-facing functions (discover, create, list, unsubscribe)
- 5 internal functions (cron, fetch, check, update)
- 1 cron job (hourly)

**Estimated time:** 1-2 days for fully working MVP

**Key simplifications:**
- No shared feeds (only you use the app)
- No feed health tracking (just log errors)
- No complex backoff (retry next hour)
- Direct deduplication (check articles table)
- Reuse existing article parser

**Next steps:**
1. Add schema table
2. Implement backend functions
3. Add cron job
4. Build UI components
5. Test with real feeds

That's it! Simple, clean, and functional. Perfect for personal use. 🚀
