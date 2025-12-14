# Better Auth Migration Analysis

This document analyzes the migration from Auth0 to Better Auth for Sora, providing a difficulty assessment and step-by-step implementation guide.

## Executive Summary

| Aspect | Assessment |
|--------|------------|
| **Migration Difficulty** | Moderate (2-3 hours of focused work) |
| **Breaking Changes** | Minimal - same `ctx.auth.getUserIdentity()` pattern |
| **Data Migration** | None needed (single user, fresh start acceptable) |
| **Files to Modify** | ~8 files |
| **Benefits** | Self-hosted, simpler config, no external dashboard |

---

## Why Better Auth?

### Current Auth0 Pain Points
- External service dependency
- Dashboard configuration required
- Multiple environment variables (domain, client ID)
- Separate config for Convex backend and Next.js frontend
- OAuth app registration on Auth0 dashboard

### Better Auth Advantages
- **Self-hosted**: All auth data lives in your Convex database
- **Single source of truth**: One configuration file
- **Built-in providers**: Email/password, OAuth (GitHub, Google, etc.)
- **Convex-native**: First-class integration via `@convex-dev/better-auth`
- **Simpler setup**: Just a secret key, no external dashboard

---

## Architecture Comparison

### Current Auth0 Flow
```
User → Auth0 Universal Login → Auth0 servers → JWT → Convex validates JWT
                                    ↓
                              Auth0 Dashboard
                              (external service)
```

### Better Auth Flow
```
User → Better Auth UI → Convex HTTP routes → Convex database (sessions/users)
                              ↓
                        All self-contained
```

---

## Key Technical Differences

### 1. Authentication Pattern (NO CHANGE NEEDED)

Both Auth0 and Better Auth use the same Convex pattern:

```typescript
// This stays exactly the same in all your Convex functions
const identity = await ctx.auth.getUserIdentity();
if (!identity) {
  throw new Error("Not authenticated");
}
const userId = identity.subject;
```

**Why this works**: Better Auth issues JWTs that Convex validates the same way it validates Auth0 JWTs. The `identity.subject` field will contain the Better Auth user ID instead of the Auth0 user ID.

### 2. User ID Format Change

| Auth Provider | User ID Format |
|--------------|----------------|
| Auth0 | `auth0\|690ce93f5124e5c8ba7134e3` |
| Better Auth | Convex document ID (e.g., `j571234567890abcd`) |

**Impact**: Since you're the only user, existing data can be updated with a simple migration script, or you can start fresh.

### 3. Provider Configuration

**Auth0 (current)**:
```typescript
// convex/auth.config.ts
export default {
  providers: [{
    domain: process.env.AUTH0_DOMAIN!,
    applicationID: process.env.AUTH0_CLIENT_ID!,
  }],
};
```

**Better Auth (new)**:
```typescript
// convex/auth.ts
import { betterAuth } from "@convex-dev/better-auth";

export const { auth, signIn, signOut } = betterAuth({
  emailAndPassword: { enabled: true },
  socialProviders: {
    github: {
      clientId: process.env.GITHUB_CLIENT_ID!,
      clientSecret: process.env.GITHUB_CLIENT_SECRET!,
    },
  },
});
```

---

## Migration Difficulty Assessment

### Easy Parts
- **Convex functions unchanged**: All 50+ functions using `ctx.auth.getUserIdentity()` work as-is
- **Schema unchanged**: `userId: v.string()` pattern remains valid
- **No REST API**: No external endpoints to reconfigure

### Moderate Parts
- **Provider replacement**: Swap `Auth0Provider` → Better Auth client
- **Login UI**: Replace Auth0 Universal Login redirect with Better Auth components
- **Environment variables**: Different set of env vars

### Considerations
- **OAuth setup**: If you want GitHub/Google login, you'll need to create OAuth apps (same as Auth0, but directly on GitHub/Google)
- **Email/password**: Better Auth has this built-in; Auth0 required database connections

---

## Step-by-Step Implementation Guide

### Phase 1: Install Dependencies

```bash
# Remove Auth0 packages
pnpm remove @auth0/auth0-react @convex-dev/auth @auth/core

# Install Better Auth packages
pnpm add better-auth@1.3.34 --save-exact
pnpm add @convex-dev/better-auth

# Ensure Convex is up to date (requires 1.25.0+)
pnpm add convex@latest -D
```

### Phase 2: Configure Convex Component

**Create `convex/convex.config.ts`** (new file):
```typescript
import { defineApp } from "convex/server";
import betterAuth from "@convex-dev/better-auth/convex.config";

const app = defineApp();
app.use(betterAuth);
export default app;
```

### Phase 3: Set Up Better Auth Configuration

**Replace `convex/auth.ts`**:
```typescript
import { BetterAuth } from "@convex-dev/better-auth";
import { components } from "./_generated/api";

export const authComponent = new BetterAuth(components.betterAuth, {
  // Email/password authentication (simplest option)
  emailAndPassword: {
    enabled: true,
  },
  // Optional: Add OAuth providers
  // socialProviders: {
  //   github: {
  //     clientId: process.env.GITHUB_CLIENT_ID!,
  //     clientSecret: process.env.GITHUB_CLIENT_SECRET!,
  //   },
  // },
});

export const createAuth = authComponent.createAuth;
```

**Replace `convex/auth.config.ts`**:
```typescript
export default {
  providers: [
    {
      domain: process.env.CONVEX_SITE_URL,
      applicationID: "convex",
    },
  ],
};
```

### Phase 4: Register HTTP Routes

**Update `convex/http.ts`**:
```typescript
import { httpRouter } from "convex/server";
import { authComponent, createAuth } from "./auth";

const http = httpRouter();

// Register Better Auth routes
authComponent.registerRoutes(http, createAuth);

// Keep your existing routes (e.g., iOS Shortcuts)
// http.route({ ... });

export default http;
```

### Phase 5: Set Environment Variables

```bash
# Generate and set the auth secret
npx convex env set BETTER_AUTH_SECRET=$(openssl rand -base64 32)

# Set your site URL
npx convex env set SITE_URL http://localhost:3000

# For production, update SITE_URL to your actual domain
# npx convex env set SITE_URL https://sora.yourdomain.com

# Remove old Auth0 env vars (optional cleanup)
npx convex env unset AUTH0_DOMAIN
npx convex env unset AUTH0_CLIENT_ID
```

**Update `.env.local`**:
```bash
# Keep these
NEXT_PUBLIC_CONVEX_URL=https://your-deployment.convex.cloud
CONVEX_DEPLOYMENT=your-deployment

# Add this
SITE_URL=http://localhost:3000

# Remove these (no longer needed)
# NEXT_PUBLIC_AUTH0_DOMAIN=...
# NEXT_PUBLIC_AUTH0_CLIENT_ID=...
```

### Phase 6: Create Next.js Route Handler

**Create `src/app/api/auth/[...all]/route.ts`** (new file):
```typescript
import { nextJsHandler } from "@convex-dev/better-auth/nextjs";

export const { GET, POST } = nextJsHandler();
```

### Phase 7: Update Auth Client Provider

**Replace `src/components/providers/ConvexClientProvider.tsx`**:
```typescript
"use client";

import { ConvexReactClient } from "convex/react";
import { ConvexProvider } from "convex/react";
import { ConvexQueryCacheProvider } from "convex-helpers/react/cache/provider";
import { ReactNode } from "react";

const convex = new ConvexReactClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export function ConvexClientProvider({ children }: { children: ReactNode }) {
  return (
    <ConvexProvider client={convex}>
      <ConvexQueryCacheProvider>{children}</ConvexQueryCacheProvider>
    </ConvexProvider>
  );
}
```

**Create `src/lib/auth-client.ts`** (new file):
```typescript
import { createAuthClient } from "better-auth/react";
import { convexClient } from "@convex-dev/better-auth/client/plugins";

export const authClient = createAuthClient({
  plugins: [convexClient()],
});

// Export hooks for easy use
export const {
  signIn,
  signUp,
  signOut,
  useSession
} = authClient;
```

### Phase 8: Update Auth Page

**Replace `src/app/auth/page.tsx`**:
```typescript
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signIn, signUp, useSession } from "@/lib/auth-client";
import { useEffect } from "react";

export default function AuthPage() {
  const router = useRouter();
  const { data: session, isPending } = useSession();
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isPending && session) {
      router.push("/dashboard");
    }
  }, [session, isPending, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      if (isSignUp) {
        await signUp.email({ email, password });
      } else {
        await signIn.email({ email, password });
      }
      router.push("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Authentication failed");
    } finally {
      setLoading(false);
    }
  };

  if (isPending) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="w-full max-w-md p-8 space-y-6">
        <h1 className="text-2xl font-bold text-center">
          {isSignUp ? "Create Account" : "Sign In"}
        </h1>

        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full p-3 border rounded-lg"
            required
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full p-3 border rounded-lg"
            minLength={8}
            required
          />

          {error && <p className="text-red-500 text-sm">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full p-3 bg-primary text-primary-foreground rounded-lg"
          >
            {loading ? "Loading..." : isSignUp ? "Sign Up" : "Sign In"}
          </button>
        </form>

        <p className="text-center text-sm">
          {isSignUp ? "Already have an account?" : "Don't have an account?"}{" "}
          <button
            onClick={() => setIsSignUp(!isSignUp)}
            className="text-primary underline"
          >
            {isSignUp ? "Sign In" : "Sign Up"}
          </button>
        </p>
      </div>
    </div>
  );
}
```

### Phase 9: Update Root Page

**Update `src/app/page.tsx`**:
```typescript
"use client";

import { useSession } from "@/lib/auth-client";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function Home() {
  const router = useRouter();
  const { data: session, isPending } = useSession();

  useEffect(() => {
    if (!isPending) {
      if (session) {
        router.push("/dashboard");
      } else {
        router.push("/auth");
      }
    }
  }, [isPending, session, router]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <p className="text-lg">
        {isPending ? "Loading..." : "Redirecting..."}
      </p>
    </div>
  );
}
```

### Phase 10: Update Sidebar Logout

**Update `src/components/app-sidebar.tsx`**:
```typescript
// Replace:
// import { useAuth0 } from "@auth0/auth0-react";
// const { logout } = useAuth0();

// With:
import { signOut } from "@/lib/auth-client";

// Update the logout handler:
const handleSignOut = () => {
  signOut();
};
```

### Phase 11: Update User Query (Optional)

**Update `convex/users.ts`** to use Better Auth's user lookup:
```typescript
import { query } from "./_generated/server";
import { authComponent } from "./auth";

export const viewer = query({
  args: {},
  handler: async (ctx) => {
    return authComponent.getAuthUser(ctx);
  },
});
```

### Phase 12: Data Migration (Optional)

If you want to preserve existing data, run this one-time migration:

```typescript
// convex/migrations.ts (temporary file)
import { mutation } from "./_generated/server";

export const migrateUserIds = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const newUserId = identity.subject;
    const oldUserId = "auth0|690ce93f5124e5c8ba7134e3"; // Your old Auth0 ID

    // Update all tables
    const tables = ["articles", "articleContents", "books", "highlights",
                    "bookmarks", "feeds", "tags", "userPreferences", "inspirations"];

    for (const table of tables) {
      const docs = await ctx.db
        .query(table as any)
        .filter((q) => q.eq(q.field("userId"), oldUserId))
        .collect();

      for (const doc of docs) {
        await ctx.db.patch(doc._id, { userId: newUserId });
      }
    }

    return { migrated: true };
  },
});
```

---

## Files Changed Summary

| File | Action | Complexity |
|------|--------|------------|
| `package.json` | Modify deps | Simple |
| `convex/convex.config.ts` | Create | Simple |
| `convex/auth.ts` | Replace | Moderate |
| `convex/auth.config.ts` | Replace | Simple |
| `convex/http.ts` | Modify | Simple |
| `src/app/api/auth/[...all]/route.ts` | Create | Simple |
| `src/components/providers/ConvexClientProvider.tsx` | Simplify | Simple |
| `src/lib/auth-client.ts` | Create | Simple |
| `src/app/auth/page.tsx` | Replace | Moderate |
| `src/app/page.tsx` | Modify | Simple |
| `src/components/app-sidebar.tsx` | Modify | Simple |
| `convex/users.ts` | Optional modify | Simple |
| `.env.local` | Modify | Simple |

**Total: 8-12 files** (depending on optional changes)

---

## Testing Checklist

After migration, verify:

- [ ] Sign up with email/password works
- [ ] Sign in with email/password works
- [ ] Sign out works
- [ ] Protected routes redirect unauthenticated users
- [ ] Convex queries return data for authenticated user
- [ ] Convex mutations work (save article, etc.)
- [ ] Session persists across page refresh
- [ ] iOS Shortcuts API still works (if using)

---

## Rollback Plan

If issues arise:

1. Revert package.json changes
2. Restore original auth files from git
3. Re-set Auth0 environment variables
4. Run `pnpm install`

Since you're the only user and this is a personal app, rollback is straightforward.

---

## Optional Enhancements

### Add OAuth Providers

```typescript
// In convex/auth.ts
socialProviders: {
  github: {
    clientId: process.env.GITHUB_CLIENT_ID!,
    clientSecret: process.env.GITHUB_CLIENT_SECRET!,
  },
  google: {
    clientId: process.env.GOOGLE_CLIENT_ID!,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
  },
},
```

### Add Two-Factor Authentication

Better Auth supports 2FA out of the box via plugins.

### Add Magic Link Login

```typescript
// In convex/auth.ts
magicLink: {
  enabled: true,
  sendMagicLink: async ({ email, url }) => {
    // Integrate with email service (Resend, SendGrid, etc.)
  },
},
```

---

## Resources

- [Better Auth Documentation](https://www.better-auth.com/)
- [Better Auth GitHub](https://github.com/better-auth/better-auth)
- [@convex-dev/better-auth npm](https://www.npmjs.com/package/@convex-dev/better-auth)
- [Convex + Better Auth Guide](https://convex-better-auth.netlify.app/)
- [Convex Auth Documentation](https://docs.convex.dev/auth)
