import { v } from "convex/values";
import { mutation, query, internalMutation, internalQuery } from "./_generated/server";

/**
 * Mutation: Create a feed subscription (internal, called by discoverAndSubscribeFeed)
 */
export const createSubscription = internalMutation({
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

/**
 * Query: List all user's subscribed feeds
 */
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

/**
 * Mutation: Remove a feed subscription
 */
export const unsubscribeFeed = mutation({
  args: {
    subscriptionId: v.id("feedSubscriptions"),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    const userId = identity.subject;

    // Verify ownership
    const subscription = await ctx.db.get(args.subscriptionId);
    if (!subscription || subscription.userId !== userId) {
      throw new Error("Subscription not found");
    }

    await ctx.db.delete(args.subscriptionId);
    return { success: true };
  },
});

/**
 * Query: Get all subscriptions (internal, for cron job)
 */
export const getAllSubscriptionsInternal = internalQuery({
  handler: async (ctx) => {
    return await ctx.db.query("feedSubscriptions").collect();
  },
});

/**
 * Query: Check if article already exists for user
 */
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

/**
 * Mutation: Update subscription's lastFetchedAt timestamp
 */
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
