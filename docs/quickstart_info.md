# Sora - Setup Guide

## Project Overview

**Sora** is a personal reading and content management app. The MVP focuses on saving articles to read later, but the architecture is designed to be extensible for future content types.

**MVP Features:**
- Save articles from URLs
- Parse and extract article content, metadata, and images
- Organize articles with tags
- List and filter saved articles
- iOS app for quick access

**Future Extensions (Planned):**
- Reading lists (collections of articles/books/content)
- Book tracking and reading progress
- Highlights and notes
- Export/share functionality
- Web interface

## Design Principles

- **Backend-heavy:** All parsing, logic, and content management happens server-side (Next.js + Convex)
- **Thin iOS client:** iOS app is purely a UI layer—just fetches and displays data
- **Extensible schema:** Database design allows easy addition of new content types (books, highlights, lists, etc.)
- **Modular API:** Clear separation between parsing logic, database operations, and API routes

---

# Article Saving App - Setup Guide

## Packages installed so far

```bash
pnpm install convex cheerio zod
pnpm install -D convex
```

**Why each:**
- `convex`: Database, auth, and serverless functions
- `cheerio`: HTML parsing and article extraction
- `zod`: Schema validation for API requests/responses

## Folder Structure

```
project-root/
├─ convex/
│  ├─ schema.ts                   # DB schema (users, articles, tags)
│  ├─ articles.ts                 # Queries & mutations (auth-guarded)
│  ├─ auth.ts                     # Convex Auth config & providers
│  └─ http.ts                     # Exposes /auth/* for Convex Auth
│
├─ src/
│  ├─ app/
│  │  ├─ (app)/
│  │  │  ├─ layout.tsx
│  │  │  └─ page.tsx              # Optional: web UI
│  │  ├─ api/
│  │  │  └─ articles/
│  │  │     ├─ route.ts           # GET (list), POST (create)
│  │  │     └─ [id]/
│  │  │        └─ route.ts        # GET, PATCH, DELETE
│  │  └─ globals.css
│  │
│  ├─ components/
│  │  └─ auth-buttons.tsx         # Sign in/out UI
│  │
│  └─ lib/
│     ├─ convexClient.ts          # Convex HTTP client setup
│     ├─ validation.ts            # Zod schemas (SaveArticleSchema, etc.)
│     ├─ env.ts                   # Zod-validated environment variables
│     └─ server/
│        └─ parser.ts             # Cheerio parsing (server-only)
│
├─ public/
├─ package.json
├─ next.config.mjs
└─ tsconfig.json
```

## Convex Auth Setup (`convex/auth.ts`) (with OTP)

```typescript
import { defineAuth } from "@convex-dev/auth/server";

export const { auth, signIn, signOut, getCurrentUser } = defineAuth({

});
```

## Convex HTTP Setup (`convex/http.ts`)

```typescript
import { httpRouter } from "convex/server";
import { auth } from "./auth";

const http = httpRouter();

http.route({
  path: "/auth/{provider}",
  method: "GET",
  handler: auth.redirect,
});

export default http;
```

## Convex Schema (`convex/schema.ts`)

```typescript
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  users: defineTable({
    email: v.string(),
    name: v.optional(v.string()),
    tokenIdentifier: v.string(),
  }).index("by_token", ["tokenIdentifier"]),

  articles: defineTable({
    userId: v.id("users"),
    url: v.string(),
    title: v.string(),
    content: v.string(),
    excerpt: v.optional(v.string()),
    imageUrl: v.optional(v.string()),
    tags: v.array(v.string()),
    savedAt: v.number(),
    readAt: v.optional(v.number()),
  })
    .index("by_user", ["userId"])
    .index("by_saved_at", ["userId", "savedAt"]),

  tags: defineTable({
    userId: v.id("users"),
    name: v.string(),
  }).index("by_user", ["userId"]),
});
```

## Convex Functions

### `convex/articles.ts`

```typescript
import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { parseArticle } from "../lib/parser";

export const saveArticle = mutation({
  args: {
    url: v.string(),
    tags: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    // Get or create user
    let user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .first();

    if (!user) {
      const userId = await ctx.db.insert("users", {
        email: identity.email || "",
        name: identity.name,
        tokenIdentifier: identity.tokenIdentifier,
      });
      user = { _id: userId };
    }

    // Parse article
    const parsed = await parseArticle(args.url);

    // Save to database
    const articleId = await ctx.db.insert("articles", {
      userId: user._id,
      url: args.url,
      title: parsed.title,
      content: parsed.content,
      excerpt: parsed.excerpt,
      imageUrl: parsed.imageUrl,
      tags: args.tags || [],
      savedAt: Date.now(),
    });

    return articleId;
  },
});

export const listArticles = query({
  args: {
    tag: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .first();

    if (!user) return [];

    let query = ctx.db
      .query("articles")
      .withIndex("by_user", (q) => q.eq("userId", user._id));

    const articles = await query.collect();

    // Filter by tag if provided
    if (args.tag) {
      return articles
        .filter((a) => a.tags.includes(args.tag!))
        .slice(0, args.limit || 50);
    }

    return articles.slice(0, args.limit || 50);
  },
});

export const deleteArticle = mutation({
  args: { articleId: v.id("articles") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const article = await ctx.db.get(args.articleId);
    if (!article) throw new Error("Article not found");

    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .first();

    if (user?._id !== article.userId) throw new Error("Unauthorized");

    await ctx.db.delete(args.articleId);
  },
});

export const addTag = mutation({
  args: {
    articleId: v.id("articles"),
    tag: v.string(),
  },
  handler: async (ctx, args) => {
    const article = await ctx.db.get(args.articleId);
    if (!article) throw new Error("Article not found");

    const tags = [...new Set([...article.tags, args.tag])]; // Avoid duplicates

    await ctx.db.patch(args.articleId, { tags });
  },
});
```

## Convex Client (`src/lib/convexClient.ts`)

```typescript
import { ConvexHttpClient } from "convex/browser";

if (!process.env.NEXT_PUBLIC_CONVEX_URL) {
  throw new Error("NEXT_PUBLIC_CONVEX_URL is not set");
}

export const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL);
```

## Environment Validation (`src/lib/env.ts`)

```typescript
import { z } from "zod";

const envSchema = z.object({
  NEXT_PUBLIC_CONVEX_URL: z.string().url(),
});

export const env = envSchema.parse(process.env);
```

## Article Parser (`src/lib/server/parser.ts`)

```typescript
import * as cheerio from "cheerio";

interface ParsedArticle {
  title: string;
  content: string;
  excerpt: string;
  imageUrl?: string;
}

export async function parseArticle(url: string): Promise<ParsedArticle> {
  try {
    const response = await fetch(url);
    const html = await response.text();
    const $ = cheerio.load(html);

    // Extract title
    let title = $("h1").first().text() || $("title").text() || "Untitled";
    title = title.trim().substring(0, 200);

    // Extract main content
    const article = $("article").length > 0 ? $("article") : $("main");
    let content = article.text() || $("body").text();
    content = content.trim().substring(0, 10000);

    // Extract excerpt
    const excerpt = content.substring(0, 300) + "...";

    // Extract image
    let imageUrl;
    const ogImage = $('meta[property="og:image"]').attr("content");
    const twitterImage = $('meta[name="twitter:image"]').attr("content");
    imageUrl = ogImage || twitterImage;

    return {
      title,
      content,
      excerpt,
      imageUrl,
    };
  } catch (error) {
    throw new Error(`Failed to parse article: ${error}`);
  }
}
```

## Zod Schemas (`src/lib/validation.ts`)

```typescript
import { z } from "zod";

export const SaveArticleSchema = z.object({
  url: z.string().url("Invalid URL"),
  tags: z.array(z.string()).optional(),
});

export const ListArticlesSchema = z.object({
  tag: z.string().optional(),
  limit: z.number().int().max(100).optional(),
});

export const ArticleResponseSchema = z.object({
  _id: z.string(),
  title: z.string(),
  content: z.string(),
  excerpt: z.string().optional(),
  imageUrl: z.string().optional(),
  tags: z.array(z.string()),
  url: z.string(),
  savedAt: z.number(),
});

export type Article = z.infer<typeof ArticleResponseSchema>;
```



## API Routes

### `src/app/api/articles/route.ts`

```typescript
import { NextRequest, NextResponse } from "next/server";
import { convex } from "@/lib/convexClient";
import { SaveArticleSchema, ListArticlesSchema } from "@/lib/validation";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const tag = searchParams.get("tag") || undefined;
    const limit = searchParams.get("limit") ? parseInt(searchParams.get("limit")!) : undefined;

    const parsed = ListArticlesSchema.parse({ tag, limit });
    const articles = await convex.query("articles:listArticles", parsed);

    return NextResponse.json(articles);
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch articles" }, { status: 400 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = SaveArticleSchema.parse(body);

    const articleId = await convex.mutation("articles:saveArticle", parsed);

    return NextResponse.json({ articleId }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: "Failed to save article" }, { status: 400 });
  }
}
```

### `src/app/api/articles/[id]/route.ts`

```typescript
import { NextRequest, NextResponse } from "next/server";
import { convex } from "@/lib/convexClient";

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await convex.mutation("articles:deleteArticle", {
      articleId: params.id,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: "Failed to delete article" }, { status: 400 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();
    const { tag } = body;

    if (!tag) {
      return NextResponse.json({ error: "Tag required" }, { status: 400 });
    }

    await convex.mutation("articles:addTag", {
      articleId: params.id,
      tag,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: "Failed to add tag" }, { status: 400 });
  }
}
```

## iOS Integration Points

Your future iOS app will call:

- **GET `/api/articles`** → List all saved articles
- **GET `/api/articles?tag=tech`** → Filter by tag
- **POST `/api/articles`** → Save new article
  ```json
  {
    "url": "https://example.com/article",
    "tags": ["tech", "news"]
  }
  ```
- **DELETE `/api/articles/[id]`** → Delete article
- **PATCH `/api/articles/[id]`** → Add tag to article
  ```json
  {
    "tag": "important"
  }
  ```

All responses are simple JSON. No complex state management needed on the iOS side.
