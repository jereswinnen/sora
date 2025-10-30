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
 * Default articles for dummy data
 * Each article can have its own tags, or use the default tags if not specified
 */
const DEFAULT_DUMMY_ARTICLES = [
  {
    url: "https://simonwillison.net/2025/Oct/22/living-dangerously-with-claude/",
    tags: ["AI", "Claude", "tech"],
  },
  {
    url: "https://rknight.me/blog/get-okay/",
    tags: ["personal", "life"],
  },
  {
    url: "https://gosha.net/2025/photo-workflow/",
    tags: ["photography"],
  },
  {
    url: "https://jeremybassetti.com/fieldnotes/2025/post-documentary-photography/",
    tags: ["photography"],
  },
  {
    url: "https://matthiasott.com/notes/listening-closely",
    tags: ["web development"],
  },
  {
    url: "https://samwarnick.com/blog/migrating-samwarnick-com-to-be-self-hosted/",
    tags: ["web development"],
  },
];

/**
 * Default tags (used when articles are provided as plain URLs without tags)
 */
const DEFAULT_DUMMY_TAGS: string[] = [];

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

    // Build articles list with tags
    let articles: Array<{ url: string; tags: string[] }>;

    if (args.urls) {
      // User provided custom URLs - use provided tags or default tags for all
      const customTags = args.tags || DEFAULT_DUMMY_TAGS;
      articles = args.urls.map((url) => ({ url, tags: customTags }));
    } else {
      // No custom URLs - use defaults with per-article tags
      articles = DEFAULT_DUMMY_ARTICLES;
    }

    // Find the first user to associate articles with
    const user = await ctx.runQuery(internal.helpers.getFirstUser);
    if (!user) {
      throw new Error(
        "No users found in database. Please sign up in the app first, then run this command.",
      );
    }

    console.log(`Adding ${articles.length} dummy articles for user: ${user._id}`);

    const results = {
      successful: 0,
      failed: 0,
      errors: [] as string[],
    };

    // Parse and save each article
    for (const article of articles) {
      try {
        console.log(`Fetching: ${article.url}`);
        const parsed = await parseArticle(article.url);

        const authorInfo = parsed.author ? ` by ${parsed.author}` : "";
        console.log(`Parsed successfully: "${parsed.title}"${authorInfo}`);

        // Save directly to database without auth checks
        await ctx.runMutation(internal.helpers.saveArticleForUser, {
          userId: user._id,
          url: article.url,
          title: parsed.title,
          content: parsed.content,
          excerpt: parsed.excerpt,
          imageUrl: parsed.imageUrl,
          author: parsed.author,
          publishedAt: parsed.publishedAt,
          tags: article.tags,
        });

        results.successful++;
        console.log(`✓ Successfully saved: ${article.url} (tags: ${article.tags.join(", ")})`);
      } catch (error) {
        results.failed++;
        const errorMsg = `✗ Failed to save ${article.url}: ${error}`;
        results.errors.push(errorMsg);
        console.error(errorMsg);
      }
    }

    console.log("\nDummy data generation complete!");
    console.log(`Successful: ${results.successful}/${articles.length}`);
    if (results.failed > 0) {
      console.log(`Failed: ${results.failed}/${articles.length}`);
    }

    return results;
  },
});
