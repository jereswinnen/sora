import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { auth } from "./auth";

const http = httpRouter();

// Add Convex Auth HTTP routes for JWT verification and OAuth
auth.addHttpRoutes(http);

// ============================================================================
// iOS Shortcuts API
// ============================================================================

/**
 * Configuration for iOS Shortcuts API
 *
 * SETUP INSTRUCTIONS:
 * 1. Set your API key in Convex:
 *    npx convex env set SHORTCUTS_API_KEY "your-secret-key-here"
 *
 * 2. Get your Auth0 user ID:
 *    - Log into your web app
 *    - Open browser console and run: localStorage
 *    - Look for your Auth0 user ID (starts with "auth0|")
 *
 * 3. Add your user ID to the USER_ID_MAP below
 */
const USER_ID_MAP: Record<string, string> = {
  // Replace with your actual API key and Auth0 user ID
  "your-api-key-here": "your-auth0-user-id-here",
  // Example: "sk_live_abc123": "auth0|690ce93f5124e5c8ba7134e3",
};

/**
 * POST /shortcuts/save-article
 *
 * Save an article from URL via iOS Shortcuts
 *
 * Headers:
 *   X-API-Key: Your API key (must match USER_ID_MAP above)
 *
 * Body:
 *   {
 *     "url": "https://example.com/article",
 *     "tags": ["optional", "tags"]  // Optional
 *   }
 */
http.route({
  path: "/shortcuts/save-article",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    try {
      // Authenticate via API key
      const apiKey = request.headers.get("X-API-Key");
      if (!apiKey) {
        return new Response(
          JSON.stringify({ error: "Missing X-API-Key header" }),
          { status: 401, headers: { "Content-Type": "application/json" } }
        );
      }

      // Look up user ID from API key
      const userId = USER_ID_MAP[apiKey];
      if (!userId) {
        return new Response(
          JSON.stringify({ error: "Invalid API key" }),
          { status: 401, headers: { "Content-Type": "application/json" } }
        );
      }

      // Parse request body
      const body = await request.json();
      const { url, tags } = body;

      if (!url) {
        return new Response(
          JSON.stringify({ error: "Missing 'url' in request body" }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
      }

      // Save article using internal action (bypasses auth)
      const result = await ctx.runAction(internal.articles.saveArticleForUserInternal, {
        userId,
        url,
      });

      // If tags were provided, add them to the article
      if (tags && Array.isArray(tags) && tags.length > 0) {
        const { api } = await import("./_generated/api");
        for (const tag of tags) {
          if (tag && typeof tag === "string" && tag.trim()) {
            // Note: This won't work without auth context, so we skip tags for now
            // Tags can be added later via the web app
          }
        }
      }

      return new Response(
        JSON.stringify({
          success: true,
          articleId: result.articleId,
          message: "Article saved successfully",
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    } catch (error: any) {
      console.error("Error saving article via Shortcuts:", error);

      // Handle duplicate articles gracefully
      if (error.message?.includes("already exists")) {
        return new Response(
          JSON.stringify({
            success: false,
            error: "Article already saved",
          }),
          { status: 409, headers: { "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({
          success: false,
          error: error.message || "Failed to save article",
        }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }
  }),
});

export default http;
