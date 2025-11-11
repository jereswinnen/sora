"use node";

import { v } from "convex/values";
import { action, internalAction } from "./_generated/server";
import { api, internal } from "./_generated/api";
import * as cheerio from "cheerio";
import Parser from "rss-parser";

/**
 * Action: Discover and subscribe to a feed from an article URL
 *
 * This function:
 * 1. Fetches the article page HTML
 * 2. Looks for RSS/Atom feed links in the HTML
 * 3. Tries common feed URL patterns if no link found
 * 4. Validates the feed by parsing it
 * 5. Creates a subscription
 * 6. Triggers an immediate fetch
 */
export const discoverAndSubscribeFeed = action({
  args: {
    articleUrl: v.string(),
  },
  handler: async (ctx, args) => {
    // 1. Fetch article page HTML
    const response = await fetch(args.articleUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch article: HTTP ${response.status}`);
    }
    const html = await response.text();

    // 2. Parse HTML to find RSS feed link
    const $ = cheerio.load(html);

    // Look for RSS/Atom links in <head>
    let feedUrl: string | null = null;
    let feedTitle: string | null = null;

    $('link[type="application/rss+xml"], link[type="application/atom+xml"]').each((i, elem) => {
      if (!feedUrl) {
        feedUrl = $(elem).attr('href') || null;
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
    const parser = new Parser();
    const feedResponse = await fetch(feedUrl);
    if (!feedResponse.ok) {
      throw new Error(`Failed to fetch feed: HTTP ${feedResponse.status}`);
    }
    const feedXml = await feedResponse.text();
    const parsedFeed = await parser.parseString(feedXml);

    // 6. Create subscription
    await ctx.runMutation(internal.feeds.createSubscription, {
      feedUrl,
      feedTitle: parsedFeed.title || feedTitle || "RSS Feed",
      siteUrl: parsedFeed.link || new URL(args.articleUrl).origin,
    });

    // 7. Trigger immediate fetch
    await ctx.scheduler.runAfter(0, internal.feedActions.fetchAllFeeds);

    return {
      success: true,
      feedUrl,
      feedTitle: parsedFeed.title || feedTitle,
    };
  },
});

/**
 * Scheduled Action: Fetch all subscribed feeds (CRON job)
 */
export const fetchAllFeeds = internalAction({
  handler: async (ctx) => {
    // Get all subscriptions
    const subscriptions = await ctx.runQuery(internal.feeds.getAllSubscriptionsInternal);

    console.log(`Fetching ${subscriptions.length} feeds...`);

    // Fetch each feed
    for (const sub of subscriptions) {
      try {
        await ctx.runAction(internal.feedActions.fetchSingleFeed, {
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

/**
 * Action: Fetch a single feed and save new articles
 */
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
    const parser = new Parser();
    const feed = await parser.parseString(feedXml);

    // 3. Process each article (limit to 20 most recent)
    const items = feed.items.slice(0, 20);
    let savedCount = 0;

    for (const item of items) {
      if (!item.link) continue;

      // Check if article already exists
      const existing = await ctx.runQuery(internal.feeds.checkArticleExists, {
        userId: args.userId,
        url: item.link,
      });

      if (existing) {
        continue; // Skip duplicates
      }

      // Save article using existing action
      try {
        await ctx.runAction(internal.articles.saveArticleForUserInternal, {
          userId: args.userId,
          url: item.link,
        });
        savedCount++;
      } catch (error) {
        console.error(`Failed to save article ${item.link}:`, error);
      }
    }

    // 4. Update lastFetchedAt
    await ctx.runMutation(internal.feeds.updateLastFetched, {
      subscriptionId: args.subscriptionId,
    });

    console.log(`Feed ${args.feedUrl}: saved ${savedCount} new articles`);
  },
});
