# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Sora is a personal article management app (MVP) designed for extensibility. It saves articles from URLs with automatic parsing, supports tagging and organization, and is built for future expansion to books, reading lists, and highlights.

**Tech Stack:**
- **Frontend**: Next.js 16 (App Router), React 19, TailwindCSS 4
- **UI Components**: shadcn/ui (installed and configured)
- **Backend**: Convex (serverless backend-as-a-service)
- **Authentication**: Auth0 (enterprise-grade authentication for web and iOS)
- **Deployment**: Web app (Next.js) + future iOS app planned

## Development Commands

**Start development:**
```bash
# Terminal 1: Convex backend (keep running)
npx convex dev

# Terminal 2: Next.js frontend
pnpm dev
```

**Type checking:**
```bash
pnpm exec tsc --noEmit
```

**Linting:**
```bash
pnpm lint
```

**Build:**
```bash
pnpm build
```

**One-time Convex deployment check:**
```bash
npx convex dev --once
```

## Architecture

### Backend-Heavy Design

Sora follows a **backend-heavy architecture** where business logic lives in Convex functions, not in client code or API routes.

**Key principle**: Both web and iOS apps will call the **same Convex functions** directly:

```
Web App (React) → Convex Functions → Convex Database
iOS App (Swift) → Convex Functions → Convex Database
```

**No REST API layer needed** for the core app. REST API routes were removed to keep the architecture simple.

### Convex Functions Organization

**convex/articles.ts** - All article-related operations:
- **Actions** (`saveArticle`) - For external HTTP (fetching/parsing URLs)
- **Mutations** (`saveArticleToDB`, `deleteArticle`, `addTag`, `updateArticle`) - For database writes
- **Queries** (`listArticles`, `getArticle`) - For database reads

**convex/parser.ts** - Article content extraction using Cheerio (server-side HTML parsing)

**convex/auth.ts** - Convex Auth configuration (integrates with Auth0)

**convex/auth.config.ts** - JWT provider configuration for Auth0 token validation

**convex/schema.ts** - Database schema with extensibility in mind (see comments for future content types)

### Authentication Pattern

**⚠️ CRITICAL:** With Auth0, always use `ctx.auth.getUserIdentity()` to get the authenticated user:

```typescript
export const myFunction = mutation({
  handler: async (ctx, args) => {
    // Get authenticated user ID from Auth0
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }
    const userId = identity.subject; // Use Auth0 subject as userId
    // Use userId for database operations...
  },
});
```

**Why this pattern:**
- With Auth0, user identities are stored in JWT tokens, not in Convex's users table
- `identity.subject` contains the Auth0 user ID (e.g., `auth0|690ce93f5124e5c8ba7134e3`)
- This Auth0 subject serves as the userId for all database operations
- The `users`, `authSessions`, and `authAccounts` tables remain empty (this is normal)

**DO NOT use `getAuthUserId()`** - it expects a user document in the database, which doesn't exist with Auth0.

### Frontend Structure

**src/app/page.tsx** - Root redirect (auth check → dashboard or auth page)

**src/app/auth/page.tsx** - Auth page that redirects to Auth0 Universal Login

**src/app/dashboard/page.tsx** - Main UI with article CRUD operations calling Convex functions via:
- `useQuery(api.articles.listArticles)` - Real-time article list
- `useAction(api.articles.saveArticle)` - Save articles
- `useMutation(api.articles.deleteArticle)` - Delete, tag, archive operations

**src/components/providers/ConvexClientProvider.tsx** - Wraps app with `Auth0Provider` and `ConvexProviderWithAuth0`

**src/lib/env.ts** - Type-safe environment variable validation with Zod

### Key Files

**convex/schema.ts** - See inline comments for:
- Design philosophy (extensible, modular, user-centric)
- Future schema extensions (books, highlights, reading lists)
- Index strategy for queries

**docs/adding_content_types.md** - Step-by-step guide for adding new content types (books, links, highlights). Follow this pattern when extending the app.

**docs/testing_convex_functions.md** - End-to-end testing guide for the article management MVP

## Adding New Content Types

See `docs/adding_content_types.md` for the complete pattern. Summary:

1. **Add table to schema** (`convex/schema.ts`)
2. **Create Convex functions** (e.g., `convex/books.ts`) using `getAuthUserId(ctx)`
3. **Build web UI** calling functions via `useQuery`/`useMutation`/`useAction`
4. **iOS app** calls the same Convex functions

Business logic stays in Convex. Clients are thin.

## Environment Variables

**Convex (set via `npx convex env set`):**
- `AUTH0_DOMAIN` - Auth0 tenant domain (e.g., `dev-abc123.auth0.com`) - without https:// prefix
- `AUTH0_CLIENT_ID` - Auth0 application client ID (same as `NEXT_PUBLIC_AUTH0_CLIENT_ID`)

**Next.js (`.env.local`):**
- `NEXT_PUBLIC_CONVEX_URL` - Convex deployment URL (auto-created by Convex)
- `NEXT_PUBLIC_AUTH0_DOMAIN` - Auth0 tenant domain (same as Convex `AUTH0_DOMAIN`)
- `NEXT_PUBLIC_AUTH0_CLIENT_ID` - Auth0 application client ID

See `.env.local.example` for template and `docs/auth0_migration.md` for complete setup instructions.

## Important Notes

**Authentication:**
- Auth0 provides enterprise-grade authentication with support for web and iOS
- Auth state must be loaded before navigation (use `useConvexAuth()` hook)
- User sessions persist with refresh tokens
- See `docs/auth0_migration.md` for complete Auth0 setup and configuration

**Real-time Updates:**
- Convex queries are reactive - changes appear instantly across clients
- No polling or manual refresh needed

**Validation:**
- Use Convex validators (`v.string()`, `v.object()`, etc.) in function definitions
- No Zod schemas needed (REST API routes were removed)

**Parser:**
- Runs server-side in Convex actions (can't access browser APIs)
- Uses Cheerio for HTML parsing
- Extracts title, content, images, author, publish date from meta tags and content

**UI Components (shadcn/ui):**
- shadcn/ui components are installed and should be used natively wherever possible
- Do NOT add custom styling to shadcn components - keep them in their native form
- When using shadcn components, look up their documentation using the Context7 MCP (upstash-context-7-mcp) to understand proper usage patterns and available props
- Components are located in `components/ui/` and can be imported directly

## Extensibility

The app is designed for future expansion:
- **Books**: Reading progress tracking
- **Highlights**: Text selections from articles/books
- **Reading Lists**: Collections of content
- **Notes**: User annotations

Schema comments in `convex/schema.ts` show planned table structures.
