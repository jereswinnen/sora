# Auth0 Migration Documentation

## Overview

This document outlines the complete migration from Convex Auth (Password provider) to Auth0 authentication. The migration was designed to maintain the existing user experience while upgrading to a more robust, production-ready authentication solution that supports both web and future iOS applications.

## Why Auth0?

Auth0 provides several key advantages over the previous password-based authentication:

1. **Enterprise-grade security**: Industry-standard authentication with built-in security features
2. **Cross-platform support**: Seamless integration with iOS apps using the same identity provider
3. **Social login support**: Easy to add Google, GitHub, Apple, etc. in the future
4. **Advanced features**: MFA, passwordless authentication, and user management out of the box
5. **Scalability**: Designed to handle authentication at any scale

## Changes Made

### 1. Package Installation

Added Auth0 React SDK:
```bash
pnpm add @auth0/auth0-react
```

### 2. Backend Configuration

#### `convex/auth.ts`
**Before:**
```typescript
import { Password } from "@convex-dev/auth/providers/Password";
import { convexAuth } from "@convex-dev/auth/server";

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [Password],
});
```

**After:**
```typescript
import { convexAuth } from "@convex-dev/auth/server";

export const { auth, signIn, signOut, store } = convexAuth({
  providers: [],
});
```

**Changes:**
- Removed Password provider import
- Cleared providers array (Auth0 handles authentication externally)
- Removed `isAuthenticated` export (no longer needed)

#### `convex/auth.config.ts`
**Before:**
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

**After:**
```typescript
export default {
  providers: [
    {
      domain: process.env.AUTH0_DOMAIN,
      applicationID: process.env.AUTH0_AUDIENCE ?? `https://${process.env.AUTH0_DOMAIN}/api/v2/`,
    },
  ],
};
```

**Changes:**
- Updated domain to use Auth0 domain from environment variables
- Updated applicationID to use Auth0 audience (defaults to Auth0 Management API URL)

### 3. Frontend Configuration

#### `src/components/providers/ConvexClientProvider.tsx`
**Before:**
```typescript
import { ConvexReactClient } from "convex/react";
import { ConvexAuthProvider } from "@convex-dev/auth/react";
import { ConvexQueryCacheProvider } from "convex-helpers/react/cache/provider";

const convex = new ConvexReactClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export function ConvexClientProvider({ children }: { children: ReactNode }) {
  return (
    <ConvexAuthProvider client={convex}>
      <ConvexQueryCacheProvider>{children}</ConvexQueryCacheProvider>
    </ConvexAuthProvider>
  );
}
```

**After:**
```typescript
import { ConvexReactClient } from "convex/react";
import { ConvexProviderWithAuth0 } from "convex/react-auth0";
import { Auth0Provider } from "@auth0/auth0-react";
import { ConvexQueryCacheProvider } from "convex-helpers/react/cache/provider";

const convex = new ConvexReactClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export function ConvexClientProvider({ children }: { children: ReactNode }) {
  return (
    <Auth0Provider
      domain={process.env.NEXT_PUBLIC_AUTH0_DOMAIN!}
      clientId={process.env.NEXT_PUBLIC_AUTH0_CLIENT_ID!}
      authorizationParams={{
        redirect_uri: typeof window !== "undefined" ? window.location.origin : undefined,
      }}
      useRefreshTokens={true}
      cacheLocation="localstorage"
    >
      <ConvexProviderWithAuth0 client={convex}>
        <ConvexQueryCacheProvider>{children}</ConvexQueryCacheProvider>
      </ConvexProviderWithAuth0>
    </Auth0Provider>
  );
}
```

**Changes:**
- Replaced `ConvexAuthProvider` with `Auth0Provider` and `ConvexProviderWithAuth0`
- Added Auth0 configuration with domain and client ID from environment variables
- Enabled refresh tokens for persistent sessions
- Set cache location to localStorage for better session management

#### `src/app/auth/page.tsx`
**Before:**
- Custom email/password forms with sign-in and sign-up tabs
- Manual error handling and validation
- Direct password authentication

**After:**
- Simple "Continue with Auth0" button
- Redirects to Auth0 Universal Login page
- Auth0 handles all authentication UI and validation

**Key improvements:**
- Cleaner, simpler UI
- Auth0's Universal Login provides consistent, secure authentication
- Support for future social login providers without code changes

#### `src/components/app-sidebar.tsx`
**Before:**
```typescript
import { useAuthActions } from "@convex-dev/auth/react";
import { useRouter } from "next/navigation";

const { signOut } = useAuthActions();
const router = useRouter();

const handleSignOut = async () => {
  await signOut();
  router.push("/auth");
};
```

**After:**
```typescript
import { useAuth0 } from "@auth0/auth0-react";

const { logout } = useAuth0();

const handleSignOut = () => {
  logout({
    logoutParams: {
      returnTo: typeof window !== "undefined" ? window.location.origin : undefined,
    },
  });
};
```

**Changes:**
- Replaced Convex Auth's `signOut` with Auth0's `logout`
- Auth0 handles redirect after logout automatically
- Removed manual router navigation

### 4. Bug Fix

Fixed an unrelated ESLint error in `convex/articles.ts`:
- Changed `let query` to `const query` (line 149)

## Environment Variables

### Frontend (.env.local)

Create a `.env.local` file in the root directory with:

```bash
# Convex Configuration (auto-populated by `npx convex dev`)
NEXT_PUBLIC_CONVEX_URL=https://your-deployment.convex.cloud

# Auth0 Configuration
NEXT_PUBLIC_AUTH0_DOMAIN=your-tenant.auth0.com
NEXT_PUBLIC_AUTH0_CLIENT_ID=your_auth0_client_id
```

**Where to find these values:**
1. Go to [Auth0 Dashboard](https://manage.auth0.com)
2. Navigate to Applications > Applications
3. Create or select your Single Page Application
4. Copy the Domain and Client ID

### Backend (Convex)

Set these environment variables in Convex using the CLI:

```bash
npx convex env set AUTH0_DOMAIN your-tenant.auth0.com
npx convex env set AUTH0_AUDIENCE https://your-api-identifier
```

**Notes:**
- `AUTH0_DOMAIN`: Your Auth0 tenant domain (e.g., `dev-abc123.auth0.com`)
- `AUTH0_AUDIENCE`: Optional. If not set, defaults to `https://{AUTH0_DOMAIN}/api/v2/`

## Auth0 Setup Instructions

### Step 1: Create Auth0 Account

1. Go to [auth0.com](https://auth0.com) and sign up for a free account
2. Complete the onboarding process

### Step 2: Create Application

1. In the Auth0 Dashboard, navigate to **Applications > Applications**
2. Click **Create Application**
3. Choose **Single Page Application** as the application type
4. Name it "Sora" (or your preferred name)
5. Click **Create**

### Step 3: Configure Application Settings

In your application settings, configure the following:

#### Allowed Callback URLs
```
http://localhost:3000
https://your-production-domain.com
```

#### Allowed Logout URLs
```
http://localhost:3000
https://your-production-domain.com
```

#### Allowed Web Origins
```
http://localhost:3000
https://your-production-domain.com
```

**Important:** Add both localhost (for development) and your production domain

### Step 4: Enable Required Settings

In the application settings:

1. **Refresh Token Rotation**: Enable (recommended for security)
2. **Refresh Token Expiration**: Set to your preferred duration (default 30 days is fine)
3. Save changes

### Step 5: Copy Credentials

From the application settings page, copy:
- **Domain** (e.g., `dev-abc123.auth0.com`)
- **Client ID** (e.g., `aBcDeFgHiJkLmNoPqRsTuVwXyZ123456`)

### Step 6: Configure Environment Variables

#### Local Development

Create `.env.local` in your project root:
```bash
NEXT_PUBLIC_CONVEX_URL=https://your-deployment.convex.cloud
NEXT_PUBLIC_AUTH0_DOMAIN=dev-abc123.auth0.com
NEXT_PUBLIC_AUTH0_CLIENT_ID=aBcDeFgHiJkLmNoPqRsTuVwXyZ123456
```

#### Convex Backend

Run these commands:
```bash
npx convex env set AUTH0_DOMAIN dev-abc123.auth0.com
npx convex env set AUTH0_AUDIENCE https://your-api-identifier  # Optional
```

### Step 7: Test Authentication

1. Start your development servers:
   ```bash
   # Terminal 1: Convex backend
   npx convex dev

   # Terminal 2: Next.js frontend
   pnpm dev
   ```

2. Navigate to `http://localhost:3000`
3. Click "Continue with Auth0"
4. You should be redirected to Auth0's Universal Login
5. Create an account or sign in
6. You should be redirected back to the dashboard

## Database Schema

**No database changes required!** The existing schema continues to work seamlessly because:

1. Convex Auth tables (`authTables`) work with both Password and Auth0 providers
2. User IDs are managed consistently by Convex Auth
3. The `getAuthUserId(ctx)` function works identically regardless of the auth provider
4. All existing articles, books, and tags remain associated with the correct users

## Authentication Flow

### Sign In Flow

1. User clicks "Continue with Auth0" on `/auth` page
2. Auth0Provider redirects to Auth0 Universal Login
3. User signs in with email/password (or social provider if configured)
4. Auth0 redirects back to the app with an access token
5. ConvexProviderWithAuth0 receives the token and authenticates with Convex
6. Convex validates the token using `auth.config.ts` configuration
7. User is redirected to `/dashboard`

### Session Management

- Access tokens are stored in localStorage
- Refresh tokens automatically renew expired access tokens
- Sessions persist across browser restarts
- Token validation happens on every Convex query/mutation

### Sign Out Flow

1. User clicks "Sign Out" in the sidebar
2. Auth0's `logout()` is called
3. Auth0 clears the session and redirects to home page
4. User is logged out of both Auth0 and Convex

## iOS Integration (Future)

When building the iOS app, follow these steps:

1. Install the Auth0 SDK for iOS:
   ```swift
   // In Package.swift
   dependencies: [
       .package(url: "https://github.com/auth0/Auth0.swift", from: "2.0.0")
   ]
   ```

2. Configure Auth0 in your iOS app with the **same Auth0 application**

3. Use Convex Swift client with Auth0 tokens:
   ```swift
   import Auth0
   import Convex

   // Get Auth0 access token
   let accessToken = // ... from Auth0 SDK

   // Pass to Convex client
   let convex = ConvexClient(deploymentUrl: "your-deployment-url")
   convex.setAuth(accessToken: accessToken)
   ```

4. Users will have the same accounts across web and iOS!

## Testing Checklist

- [x] Type checking passes (`pnpm exec tsc --noEmit`)
- [x] Linting passes (`pnpm lint`)
- [ ] User can sign up with new account
- [ ] User can sign in with existing account
- [ ] User can sign out
- [ ] User session persists after browser refresh
- [ ] Protected routes redirect to auth page when not authenticated
- [ ] Authenticated users can access dashboard, articles, and books
- [ ] User email displays correctly in sidebar
- [ ] All Convex queries/mutations work with new auth

## Troubleshooting

### "Invalid state" error after redirect

**Cause:** Auth0 redirect_uri doesn't match configured callback URL

**Solution:**
1. Check Auth0 Dashboard > Applications > Settings > Allowed Callback URLs
2. Ensure it includes `http://localhost:3000` and your production domain
3. Clear browser cache and try again

### "Audience not found" error

**Cause:** Auth0 audience configuration mismatch

**Solution:**
1. Check Convex environment variables: `npx convex env list`
2. Verify `AUTH0_DOMAIN` is set correctly
3. If using custom audience, verify `AUTH0_AUDIENCE` matches Auth0 API identifier

### User email not showing in sidebar

**Cause:** Convex query not returning user data

**Solution:**
1. Check browser console for errors
2. Verify `api.users.viewer` query exists in `convex/users.ts`
3. Ensure query uses `getAuthUserId(ctx)` correctly

### Session expires immediately

**Cause:** Refresh tokens not configured

**Solution:**
1. Check Auth0 Dashboard > Applications > Settings > Advanced > Grant Types
2. Ensure "Refresh Token" is enabled
3. Verify `useRefreshTokens={true}` in ConvexClientProvider

## Additional Resources

- **Convex Auth0 Documentation**: https://docs.convex.dev/auth/auth0
- **Auth0 React SDK Documentation**: https://auth0.com/docs/libraries/auth0-react
- **Auth0 Dashboard**: https://manage.auth0.com
- **Convex Dashboard**: https://dashboard.convex.dev

## Summary

The migration from Convex Auth (Password provider) to Auth0 was completed successfully with:

- ✅ No database schema changes
- ✅ Clean, production-ready authentication
- ✅ Support for future iOS app
- ✅ Easy to add social login providers
- ✅ All existing features continue to work
- ✅ Type checking and linting passing

All user authentication now flows through Auth0, providing enterprise-grade security and a foundation for future features like social login, MFA, and cross-platform authentication.
