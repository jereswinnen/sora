import { action, mutation } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { parseArticle } from "./parser";

/**
 * Development Tools
 *
 * These functions are for development/debugging only and include safety checks
 * to prevent accidental use in production.
 */

/**
 * Check if dev tools are enabled
 *
 * To enable dev tools, run:
 *   npx convex env set DEV_TOOLS_ENABLED true
 *
 * To disable (for production):
 *   npx convex env unset DEV_TOOLS_ENABLED
 */
function areDevToolsEnabled(): boolean {
  const enabled = process.env.DEV_TOOLS_ENABLED === "true";
  if (!enabled) {
    console.log(
      "Dev tools are disabled. To enable, run: npx convex env set DEV_TOOLS_ENABLED true",
    );
  }
  return enabled;
}

/**
 * Clear all data from the database except users
 * WARNING: This is destructive and irreversible!
 *
 * Safety: Only works in development deployments
 *
 * Usage:
 *   npx convex run devTools:clearDatabase '{"confirm": "YES_DELETE_ALL_DATA"}'
 */
export const clearDatabase = mutation({
  args: {
    confirm: v.string(), // Must be "YES_DELETE_ALL_DATA"
  },
  handler: async (ctx, args) => {
    // Safety check 1: Confirmation string
    if (args.confirm !== "YES_DELETE_ALL_DATA") {
      throw new Error(
        'You must pass { confirm: "YES_DELETE_ALL_DATA" } to execute this command',
      );
    }

    // Safety check 2: Dev tools must be enabled
    if (!areDevToolsEnabled()) {
      throw new Error(
        "Dev tools are not enabled. Run: npx convex env set DEV_TOOLS_ENABLED true",
      );
    }

    console.log("Starting database clear (keeping users)...");

    // Delete all articles
    const articles = await ctx.db.query("articles").collect();
    for (const article of articles) {
      await ctx.db.delete(article._id);
    }
    console.log(`Deleted ${articles.length} articles`);

    // Delete all tags
    const tags = await ctx.db.query("tags").collect();
    for (const tag of tags) {
      await ctx.db.delete(tag._id);
    }
    console.log(`Deleted ${tags.length} tags`);

    // Delete all user preferences
    const prefs = await ctx.db.query("userPreferences").collect();
    for (const pref of prefs) {
      await ctx.db.delete(pref._id);
    }
    console.log(`Deleted ${prefs.length} user preferences`);

    console.log("Database cleared successfully!");

    return {
      success: true,
      deleted: {
        articles: articles.length,
        tags: tags.length,
        userPreferences: prefs.length,
      },
    };
  },
});

/**
 * Default URLs for dummy data
 * These are well-structured articles that parse reliably
 */
const DEFAULT_DUMMY_URLS = [
  "https://paulgraham.com/greatwork.html",
  "https://www.joelonsoftware.com/2000/08/09/the-joel-test-12-steps-to-better-code/",
  "https://martinfowler.com/articles/is-quality-worth-cost.html",
  "https://stackoverflow.blog/2023/12/25/is-software-getting-worse/",
];

/**
 * Default tags for dummy data
 */
const DEFAULT_DUMMY_TAGS = ["demo", "test"];

/**
 * Add dummy data to the database by parsing real URLs
 *
 * This will fetch and parse articles from the provided URLs (or default URLs if not provided).
 * Each article will be tagged with the provided tags (or default tags if not provided).
 *
 * Safety: Only works in development deployments
 *
 * Usage:
 *   # Use defaults
 *   npx convex run devTools:addDummyData
 *
 *   # Or provide custom URLs/tags
 *   npx convex run devTools:addDummyData '{"urls": ["https://example.com/article"], "tags": ["custom"]}'
 */
export const addDummyData = action({
  args: {
    urls: v.optional(v.array(v.string())),
    tags: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    // Safety check: Dev tools must be enabled
    if (!areDevToolsEnabled()) {
      throw new Error(
        "Dev tools are not enabled. Run: npx convex env set DEV_TOOLS_ENABLED true",
      );
    }

    // Use provided URLs/tags or defaults
    const urls = args.urls || DEFAULT_DUMMY_URLS;
    const tags = args.tags || DEFAULT_DUMMY_TAGS;

    // Find the first user to associate articles with
    const user = await ctx.runQuery(internal.helpers.getFirstUser);
    if (!user) {
      throw new Error(
        "No users found in database. Please sign up in the app first, then run this command.",
      );
    }

    console.log(`Adding ${urls.length} dummy articles for user: ${user._id}`);

    const results = {
      successful: 0,
      failed: 0,
      errors: [] as string[],
    };

    // Parse and save each URL
    for (const url of urls) {
      try {
        console.log(`Fetching: ${url}`);
        const parsed = await parseArticle(url);

        const authorInfo = parsed.author ? ` by ${parsed.author}` : "";
        console.log(`Parsed successfully: "${parsed.title}"${authorInfo}`);

        // Save directly to database without auth checks
        await ctx.runMutation(internal.helpers.saveArticleForUser, {
          userId: user._id,
          url,
          title: parsed.title,
          content: parsed.content,
          excerpt: parsed.excerpt,
          imageUrl: parsed.imageUrl,
          author: parsed.author,
          publishedAt: parsed.publishedAt,
          tags,
        });

        results.successful++;
        console.log(`✓ Successfully saved: ${url}`);
      } catch (error) {
        results.failed++;
        const errorMsg = `✗ Failed to save ${url}: ${error}`;
        results.errors.push(errorMsg);
        console.error(errorMsg);
      }
    }

    console.log("\nDummy data generation complete!");
    console.log(`Successful: ${results.successful}/${urls.length}`);
    if (results.failed > 0) {
      console.log(`Failed: ${results.failed}/${urls.length}`);
    }

    return results;
  },
});
