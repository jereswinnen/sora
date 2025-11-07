# Auth0 Roles & Permissions Integration Plan

## Overview

This document outlines the plan for integrating Auth0's Role-Based Access Control (RBAC) into Sora. Auth0 RBAC allows you to define roles (e.g., "admin", "editor", "viewer") and permissions (e.g., "read:articles", "write:articles") that can be assigned to users and included in tokens for authorization.

**Current State:**
- ✅ Auth0 authentication is fully integrated
- ✅ We already have `@auth0/auth0-react` installed and configured
- ✅ Convex reads user identity from JWT tokens
- ❌ No role-based authorization exists
- ❌ All authenticated users have the same access level

**Goal:**
Implement a flexible RBAC system where:
- Users can be assigned roles (e.g., "admin", "user")
- Roles grant specific permissions
- Both frontend and backend can check user roles/permissions
- Authorization logic is centralized and maintainable

## Why Use Auth0 RBAC?

**Advantages:**
1. **Enterprise-grade**: Battle-tested authorization system used by thousands of companies
2. **Centralized management**: Roles and permissions managed in Auth0 Dashboard
3. **Token-based**: Roles/permissions included in JWT tokens (no extra API calls)
4. **Cross-platform**: Same roles work for web and future iOS app
5. **Scalable**: Can start simple and expand to fine-grained permissions later
6. **Audit trail**: Auth0 logs all role assignments and changes

**When to use Auth0 RBAC:**
- You need simple role-based access (admin vs user)
- You want role management in Auth0 Dashboard (not in your app)
- You need cross-platform authorization (web + iOS)
- You need coarse-grained permissions (not document-level)

**When NOT to use Auth0 RBAC:**
- You need very fine-grained permissions (document-level, field-level)
- You need dynamic, user-configurable roles
- You need relationship-based permissions (e.g., "owner of resource X")
- For these cases, consider Auth0 Fine-Grained Authorization (FGA) instead

## Architecture Overview

### How Auth0 RBAC Works

```
┌─────────────────────────────────────────────────────────────┐
│ 1. User Setup (One-time in Auth0 Dashboard)                │
│                                                             │
│    Create Roles → Define Permissions → Assign to Users     │
│    (e.g., "admin")  (e.g., "write:all")   (manually/API)   │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│ 2. Login Flow                                               │
│                                                             │
│    User logs in → Auth0 Action adds roles to token →       │
│    Token includes custom claims with roles/permissions     │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│ 3. Frontend Authorization (React)                           │
│                                                             │
│    useAuth0() → getIdTokenClaims() → Read roles from       │
│    custom claim → Show/hide UI elements                    │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│ 4. Backend Authorization (Convex)                           │
│                                                             │
│    ctx.auth.getUserIdentity() → Read roles from token →    │
│    Check permissions → Allow/deny operation                │
└─────────────────────────────────────────────────────────────┘
```

### Key Concepts

**Roles:**
- Named collections of permissions (e.g., "admin", "editor", "viewer")
- Assigned to users in Auth0
- Multiple roles per user supported

**Permissions:**
- Granular actions users can perform (e.g., "read:articles", "write:books")
- Must be defined in an Auth0 API configuration
- Format: `action:resource` (e.g., `delete:articles`)

**Custom Claims:**
- JWT token fields containing roles/permissions
- Must use namespaced URLs to avoid conflicts
- Example: `https://sora.app/roles` → `["admin", "user"]`

**Auth0 Actions:**
- Serverless functions that run during authentication
- Used to add roles/permissions to tokens
- Execute after user logs in, before token is issued

## Implementation Plan

### Phase 1: Auth0 Setup (Dashboard Configuration)

#### Step 1.1: Define Your API in Auth0

**Why:** Permissions must be associated with an API identifier (audience).

**Steps:**
1. Go to Auth0 Dashboard → Applications → APIs
2. Click "Create API"
3. Settings:
   - **Name**: "Sora API"
   - **Identifier**: `https://api.sora.app` (can be any URL, doesn't need to exist)
   - **Signing Algorithm**: RS256
4. Click "Create"

#### Step 1.2: Enable RBAC for the API

**Why:** This tells Auth0 to enforce role-based access control.

**Steps:**
1. In the API settings, scroll to "RBAC Settings"
2. Enable **"Enable RBAC"**
3. Enable **"Add Permissions in the Access Token"**
4. Click "Save"

**What this does:**
- Permissions will be included in the `permissions` claim of access tokens
- Scopes become intersection of requested + assigned permissions

#### Step 1.3: Define Permissions

**Why:** Permissions are the building blocks of RBAC.

**Example permissions for Sora:**

| Permission | Description | Use Case |
|------------|-------------|----------|
| `read:articles` | Read articles | All users |
| `write:articles` | Create/edit articles | All users (user owns their data) |
| `delete:articles` | Delete articles | All users (user owns their data) |
| `read:books` | Read books | All users |
| `write:books` | Create/edit books | All users |
| `delete:books` | Delete books | All users |
| `admin:users` | Manage users | Admins only |
| `admin:analytics` | View analytics | Admins only |

**Steps:**
1. In your API → Permissions tab
2. Click "Add Permission"
3. For each permission:
   - **Permission**: `read:articles`
   - **Description**: "Read articles"
4. Repeat for all permissions

**💡 Tip:** Start with broad permissions. You can always add more granular ones later.

#### Step 1.4: Create Roles

**Example roles for Sora:**

**Role: `user` (Default)**
- Permissions:
  - `read:articles`
  - `write:articles`
  - `delete:articles`
  - `read:books`
  - `write:books`
  - `delete:books`

**Role: `admin` (Elevated)**
- Permissions:
  - All `user` permissions
  - `admin:users`
  - `admin:analytics`

**Steps:**
1. Go to User Management → Roles
2. Click "Create Role"
3. Settings:
   - **Name**: `user`
   - **Description**: "Standard user with access to their own data"
4. Click "Create"
5. Go to Permissions tab → "Add Permissions"
6. Select your API and check all relevant permissions
7. Repeat for `admin` role

#### Step 1.5: Assign Roles to Users

**Manual Assignment (for initial setup):**
1. Go to User Management → Users
2. Select a user
3. Go to Roles tab → "Assign Roles"
4. Select `user` or `admin`

**Programmatic Assignment (for production):**
- Use Management API: `POST /api/v2/users/{user_id}/roles`
- Or use Auth0 Actions to auto-assign default role on signup

### Phase 2: Add Roles to Tokens (Auth0 Actions)

#### Step 2.1: Create Post-Login Action

**Why:** By default, Auth0 doesn't include roles in tokens. An Action adds them.

**Steps:**
1. Go to Actions → Library
2. Click "Build Custom"
3. Settings:
   - **Name**: "Add Roles to Tokens"
   - **Trigger**: "Login / Post Login"
   - **Runtime**: Node 18
4. Click "Create"

#### Step 2.2: Add Action Code

**Code:**
```javascript
/**
 * Add user roles and permissions to ID and Access tokens
 *
 * This Action runs after successful authentication and adds
 * role/permission claims to tokens for authorization.
 */
exports.onExecutePostLogin = async (event, api) => {
  // Define namespace (must be a URL you control, but doesn't need to exist)
  const namespace = 'https://sora.app';

  // Check if authorization data exists (user has roles assigned)
  if (event.authorization) {
    // Add roles to both ID token (for frontend) and access token (for APIs)
    api.idToken.setCustomClaim(`${namespace}/roles`, event.authorization.roles);
    api.accessToken.setCustomClaim(`${namespace}/roles`, event.authorization.roles);

    // Optional: Add permissions if you need fine-grained checks
    // api.idToken.setCustomClaim(`${namespace}/permissions`, event.authorization.permissions);
    // api.accessToken.setCustomClaim(`${namespace}/permissions`, event.authorization.permissions);
  } else {
    // No roles assigned - set empty array
    // This prevents undefined checks in your app
    api.idToken.setCustomClaim(`${namespace}/roles`, []);
    api.accessToken.setCustomClaim(`${namespace}/roles`, []);
  }

  // Optional: Add user metadata for convenience
  // api.idToken.setCustomClaim(`${namespace}/user_metadata`, event.user.user_metadata);
  // api.accessToken.setCustomClaim(`${namespace}/user_metadata`, event.user.user_metadata);
};
```

**⚠️ Critical:** The namespace MUST be a valid URL format (e.g., `https://sora.app` or `https://sora.app/claims`). You can't use `sora` or `sora.app` alone.

#### Step 2.3: Deploy the Action

**Steps:**
1. Click "Deploy"
2. Go to Actions → Flows → Login
3. Drag your "Add Roles to Tokens" action into the flow (between "Start" and "Complete")
4. Click "Apply"

**Test:**
1. Log out and log back in
2. Open browser DevTools → Application → Local Storage
3. Find the Auth0 token
4. Copy the ID token value
5. Go to https://jwt.io and paste the token
6. Verify you see your custom claim: `"https://sora.app/roles": ["user"]`

### Phase 3: Frontend Integration (React)

#### Step 3.1: Create Authorization Utilities

**Create `src/lib/auth.ts`:**
```typescript
/**
 * Auth0 RBAC utilities for frontend authorization
 */

// Must match the namespace in your Auth0 Action
const ROLES_CLAIM = 'https://sora.app/roles';
const PERMISSIONS_CLAIM = 'https://sora.app/permissions';

export type UserRole = 'user' | 'admin';

export interface TokenClaims {
  [ROLES_CLAIM]?: UserRole[];
  [PERMISSIONS_CLAIM]?: string[];
}

/**
 * Extract roles from ID token claims
 */
export function getRolesFromClaims(claims?: TokenClaims): UserRole[] {
  if (!claims) return [];
  return claims[ROLES_CLAIM] || [];
}

/**
 * Extract permissions from ID token claims
 */
export function getPermissionsFromClaims(claims?: TokenClaims): string[] {
  if (!claims) return [];
  return claims[PERMISSIONS_CLAIM] || [];
}

/**
 * Check if user has a specific role
 */
export function hasRole(claims: TokenClaims | undefined, role: UserRole): boolean {
  const roles = getRolesFromClaims(claims);
  return roles.includes(role);
}

/**
 * Check if user has ANY of the specified roles
 */
export function hasAnyRole(claims: TokenClaims | undefined, roles: UserRole[]): boolean {
  const userRoles = getRolesFromClaims(claims);
  return roles.some(role => userRoles.includes(role));
}

/**
 * Check if user has ALL of the specified roles
 */
export function hasAllRoles(claims: TokenClaims | undefined, roles: UserRole[]): boolean {
  const userRoles = getRolesFromClaims(claims);
  return roles.every(role => userRoles.includes(role));
}

/**
 * Check if user has a specific permission
 */
export function hasPermission(claims: TokenClaims | undefined, permission: string): boolean {
  const permissions = getPermissionsFromClaims(claims);
  return permissions.includes(permission);
}

/**
 * Check if user is an admin
 */
export function isAdmin(claims: TokenClaims | undefined): boolean {
  return hasRole(claims, 'admin');
}
```

#### Step 3.2: Create Role-Based UI Components

**Create `src/components/auth/RequireRole.tsx`:**
```typescript
import { useAuth0 } from '@auth0/auth0-react';
import { useEffect, useState } from 'react';
import { getRolesFromClaims, hasRole, type UserRole, type TokenClaims } from '@/lib/auth';

interface RequireRoleProps {
  role: UserRole;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

/**
 * Show children only if user has the required role
 */
export function RequireRole({ role, children, fallback = null }: RequireRoleProps) {
  const { getIdTokenClaims, isAuthenticated } = useAuth0();
  const [claims, setClaims] = useState<TokenClaims | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchClaims() {
      if (!isAuthenticated) {
        setLoading(false);
        return;
      }

      try {
        const tokenClaims = await getIdTokenClaims();
        setClaims(tokenClaims as TokenClaims);
      } catch (error) {
        console.error('Failed to get ID token claims:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchClaims();
  }, [getIdTokenClaims, isAuthenticated]);

  if (!isAuthenticated || loading) {
    return null;
  }

  if (!hasRole(claims || undefined, role)) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}
```

**Create `src/hooks/useUserRoles.ts`:**
```typescript
import { useAuth0 } from '@auth0/auth0-react';
import { useEffect, useState } from 'react';
import { getRolesFromClaims, type UserRole, type TokenClaims } from '@/lib/auth';

/**
 * Hook to access user roles from ID token
 */
export function useUserRoles() {
  const { getIdTokenClaims, isAuthenticated, isLoading } = useAuth0();
  const [roles, setRoles] = useState<UserRole[]>([]);
  const [claims, setClaims] = useState<TokenClaims | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchRoles() {
      if (!isAuthenticated) {
        setRoles([]);
        setLoading(false);
        return;
      }

      try {
        const tokenClaims = await getIdTokenClaims();
        setClaims(tokenClaims as TokenClaims);
        setRoles(getRolesFromClaims(tokenClaims as TokenClaims));
      } catch (error) {
        console.error('Failed to get user roles:', error);
        setRoles([]);
      } finally {
        setLoading(false);
      }
    }

    if (!isLoading) {
      fetchRoles();
    }
  }, [getIdTokenClaims, isAuthenticated, isLoading]);

  return {
    roles,
    claims,
    loading: isLoading || loading,
    isAdmin: roles.includes('admin'),
    hasRole: (role: UserRole) => roles.includes(role),
  };
}
```

#### Step 3.3: Use in Components

**Example: Show admin-only button**
```tsx
import { RequireRole } from '@/components/auth/RequireRole';

export function ArticleList() {
  return (
    <div>
      <h1>Articles</h1>

      {/* Only admins see this */}
      <RequireRole role="admin">
        <button>View Analytics</button>
      </RequireRole>

      {/* Everyone sees this */}
      <button>Create Article</button>
    </div>
  );
}
```

**Example: Using the hook**
```tsx
import { useUserRoles } from '@/hooks/useUserRoles';

export function Dashboard() {
  const { roles, isAdmin, loading } = useUserRoles();

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <div>
      <h1>Dashboard</h1>
      <p>Your roles: {roles.join(', ')}</p>

      {isAdmin && (
        <div>
          <h2>Admin Panel</h2>
          {/* Admin-only content */}
        </div>
      )}
    </div>
  );
}
```

### Phase 4: Backend Integration (Convex)

#### Step 4.1: Create Authorization Utilities

**Create `convex/auth-utils.ts`:**
```typescript
import { UserIdentity } from "convex/server";

// Must match the namespace in your Auth0 Action
const ROLES_CLAIM = 'https://sora.app/roles';
const PERMISSIONS_CLAIM = 'https://sora.app/permissions';

export type UserRole = 'user' | 'admin';

/**
 * Extract roles from Auth0 identity token
 */
export function getRoles(identity: UserIdentity): UserRole[] {
  // @ts-ignore - Custom claims not in type definition
  const roles = identity[ROLES_CLAIM];
  return Array.isArray(roles) ? roles : [];
}

/**
 * Extract permissions from Auth0 identity token
 */
export function getPermissions(identity: UserIdentity): string[] {
  // @ts-ignore - Custom claims not in type definition
  const permissions = identity[PERMISSIONS_CLAIM];
  return Array.isArray(permissions) ? permissions : [];
}

/**
 * Check if user has a specific role
 */
export function hasRole(identity: UserIdentity, role: UserRole): boolean {
  const roles = getRoles(identity);
  return roles.includes(role);
}

/**
 * Check if user has ANY of the specified roles
 */
export function hasAnyRole(identity: UserIdentity, requiredRoles: UserRole[]): boolean {
  const roles = getRoles(identity);
  return requiredRoles.some(role => roles.includes(role));
}

/**
 * Check if user has ALL of the specified roles
 */
export function hasAllRoles(identity: UserIdentity, requiredRoles: UserRole[]): boolean {
  const roles = getRoles(identity);
  return requiredRoles.every(role => roles.includes(role));
}

/**
 * Check if user has a specific permission
 */
export function hasPermission(identity: UserIdentity, permission: string): boolean {
  const permissions = getPermissions(identity);
  return permissions.includes(permission);
}

/**
 * Check if user is an admin
 */
export function isAdmin(identity: UserIdentity): boolean {
  return hasRole(identity, 'admin');
}

/**
 * Throw error if user doesn't have required role
 */
export function requireRole(identity: UserIdentity, role: UserRole): void {
  if (!hasRole(identity, role)) {
    throw new Error(`Unauthorized: Requires ${role} role`);
  }
}

/**
 * Throw error if user doesn't have required permission
 */
export function requirePermission(identity: UserIdentity, permission: string): void {
  if (!hasPermission(identity, permission)) {
    throw new Error(`Unauthorized: Requires ${permission} permission`);
  }
}
```

#### Step 4.2: Use in Convex Functions

**Example: Admin-only query**
```typescript
import { query } from "./_generated/server";
import { requireRole, isAdmin } from "./auth-utils";

/**
 * Get analytics data (admin only)
 */
export const getAnalytics = query({
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    // Require admin role
    requireRole(identity, 'admin');

    // Fetch analytics data
    const totalArticles = await ctx.db.query("articles").collect();
    const totalUsers = /* ... */;

    return {
      totalArticles: totalArticles.length,
      totalUsers,
      // ... more analytics
    };
  },
});
```

**Example: Conditional logic based on role**
```typescript
import { query } from "./_generated/server";
import { isAdmin } from "./auth-utils";

/**
 * List articles with different logic for admins
 */
export const listArticles = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const userId = identity.subject;
    const limit = args.limit || 50;

    // Admins can see all articles, users see only their own
    if (isAdmin(identity)) {
      return await ctx.db
        .query("articles")
        .order("desc")
        .take(limit);
    } else {
      return await ctx.db
        .query("articles")
        .withIndex("by_user_saved", (q) => q.eq("userId", userId))
        .order("desc")
        .take(limit);
    }
  },
});
```

**Example: Permission-based mutation**
```typescript
import { mutation } from "./_generated/server";
import { v } from "convex/values";
import { requirePermission } from "./auth-utils";

/**
 * Delete any user's article (admin only)
 */
export const adminDeleteArticle = mutation({
  args: {
    articleId: v.id("articles"),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    // Check permission
    requirePermission(identity, 'admin:articles');

    // Delete article (no ownership check)
    await ctx.db.delete(args.articleId);

    return { success: true };
  },
});
```

### Phase 5: Testing

#### Step 5.1: Manual Testing Checklist

**Setup:**
- [ ] Create test users in Auth0 Dashboard
- [ ] Assign one user the `admin` role
- [ ] Assign another user the `user` role
- [ ] Create a user with no roles

**Frontend Tests:**
- [ ] Log in as admin → Verify admin UI elements appear
- [ ] Log in as user → Verify admin UI elements are hidden
- [ ] Log in as no-role user → Verify app still works
- [ ] Check browser DevTools → Verify roles in ID token claims

**Backend Tests:**
- [ ] Call admin-only query as admin → Should succeed
- [ ] Call admin-only query as user → Should fail with "Unauthorized" error
- [ ] Call admin-only query as no-role user → Should fail
- [ ] Verify error messages are clear and don't leak sensitive info

**Edge Cases:**
- [ ] User with multiple roles → Should work correctly
- [ ] User token expires → Re-login should refresh roles
- [ ] User role changed in Auth0 → Should update after re-login

#### Step 5.2: Automated Testing

**Frontend test example (src/lib/auth.test.ts):**
```typescript
import { describe, expect, it } from 'vitest';
import { hasRole, isAdmin, getRolesFromClaims } from './auth';

describe('auth utilities', () => {
  it('should extract roles from claims', () => {
    const claims = {
      'https://sora.app/roles': ['admin', 'user'],
    };
    expect(getRolesFromClaims(claims)).toEqual(['admin', 'user']);
  });

  it('should detect admin role', () => {
    const claims = {
      'https://sora.app/roles': ['admin'],
    };
    expect(isAdmin(claims)).toBe(true);
  });

  it('should handle missing roles', () => {
    expect(getRolesFromClaims(undefined)).toEqual([]);
    expect(isAdmin(undefined)).toBe(false);
  });
});
```

**Backend test example (use Convex test framework):**
```typescript
// Test in Convex dashboard or via test scripts
import { convexTest } from "convex-test";
import { expect, test } from "vitest";
import { api } from "./_generated/api";

test("admin can access analytics", async () => {
  const t = convexTest();

  // Mock admin identity with role claim
  await t.run(async (ctx) => {
    const analytics = await api.analytics.getAnalytics(ctx);
    expect(analytics).toBeDefined();
  });
});
```

## Gotchas & Considerations

### 🚨 Critical Gotchas

1. **Custom Claim Namespace Must Be a URL**
   - ❌ Wrong: `"roles"`, `"sora"`, `"sora/roles"`
   - ✅ Correct: `"https://sora.app/roles"`, `"https://example.com/claims/roles"`
   - Why: Auth0 requires namespaced claims to avoid collisions with standard claims

2. **Auth0 Actions Must Be in the Flow**
   - Adding roles to tokens requires an Action in the Login flow
   - Just creating the Action isn't enough - you must drag it into the flow
   - Verify in Actions → Flows → Login

3. **Frontend Authorization Is NOT Security**
   - Hiding UI elements is UX, not security
   - Always enforce authorization in Convex functions
   - Assume a malicious user can call any Convex function directly

4. **Roles Don't Auto-Update**
   - Role changes in Auth0 only take effect after re-login
   - User's existing tokens still have old roles
   - For immediate effect, revoke sessions via Management API

5. **TypeScript Won't Know About Custom Claims**
   - Custom claims aren't in Auth0's type definitions
   - Use `// @ts-ignore` or type assertions when accessing them
   - Create your own `TokenClaims` interface for better types

### ⚠️ Important Considerations

**Token Size:**
- Adding many permissions increases token size
- Large tokens can cause issues with cookies/headers (8KB limit)
- Solution: Use roles in tokens, fetch permissions from API if needed

**Caching:**
- `getIdTokenClaims()` may cache results
- Roles won't update until user logs out and back in
- For real-time role updates, use Management API in your backend

**Performance:**
- Reading claims from token is fast (no API call)
- But calling `getIdTokenClaims()` on every render is wasteful
- Cache claims in React state or context

**Permissions vs Roles:**
- Roles are easier to manage (fewer moving parts)
- Permissions are more granular but more complex
- Start with roles, add permissions if needed

**Default Role Assignment:**
- New users have NO roles by default
- You must either:
  - Manually assign in Auth0 Dashboard
  - Use Management API after signup
  - Use Auth0 Action to auto-assign `user` role

### 💡 Best Practices

1. **Use Roles for UI, Permissions for APIs**
   - Frontend checks roles: `isAdmin`, `hasRole('admin')`
   - Backend checks permissions: `requirePermission('admin:analytics')`
   - This gives you flexibility to change role permissions without code changes

2. **Fail Closed, Not Open**
   - If roles can't be determined, deny access
   - Don't assume `user` role if no roles found
   - Better to show error than leak data

3. **Consistent Naming**
   - Use same claim namespace everywhere
   - Define types once, import everywhere
   - Avoids typos and inconsistencies

4. **Audit Logging**
   - Log authorization failures in Convex
   - Helps detect attacks or misconfiguration
   - Use Convex's built-in logging

5. **Progressive Enhancement**
   - Start simple: just `admin` and `user` roles
   - Add permissions when you need fine-grained control
   - Don't over-engineer upfront

## Maintenance & Operations

### Managing Roles

**Add a new role:**
1. Auth0 Dashboard → User Management → Roles → Create Role
2. Add permissions to the role
3. Assign to users (manually or via API)
4. No code changes needed!

**Modify role permissions:**
1. Auth0 Dashboard → User Management → Roles → Select role
2. Add/remove permissions
3. Users get new permissions after re-login
4. No code changes needed!

**Assign role to user:**
```bash
# Via Auth0 Management API
curl --request POST \
  --url 'https://YOUR_DOMAIN/api/v2/users/USER_ID/roles' \
  --header 'authorization: Bearer MGMT_API_TOKEN' \
  --header 'content-type: application/json' \
  --data '{ "roles": ["ROLE_ID"] }'
```

**Auto-assign default role:**
```javascript
// Add to your Post-Login Action
exports.onExecutePostLogin = async (event, api) => {
  const namespace = 'https://sora.app';

  // Auto-assign 'user' role to new users
  if (event.stats.logins_count === 1) {
    api.user.assignRole('rol_USER_ROLE_ID');
  }

  // Then add roles to token as usual
  if (event.authorization) {
    api.idToken.setCustomClaim(`${namespace}/roles`, event.authorization.roles);
    api.accessToken.setCustomClaim(`${namespace}/roles`, event.authorization.roles);
  }
};
```

### Monitoring

**Check user's current roles:**
1. Auth0 Dashboard → User Management → Users
2. Select user → Roles tab
3. Shows all assigned roles

**View Action logs:**
1. Auth0 Dashboard → Monitoring → Logs
2. Filter by "Success Login" or "Failed Login"
3. Click log entry → See Action execution details

**Debug token contents:**
1. Copy ID token from browser LocalStorage
2. Paste into https://jwt.io
3. Verify custom claims are present

### Troubleshooting

**Problem: Roles not appearing in token**
- Check: Is Action deployed?
- Check: Is Action in the Login flow?
- Check: Did user log out and back in?
- Check: Does user actually have roles assigned?

**Problem: "Unauthorized" errors in Convex**
- Check: Token has correct namespace in claims?
- Check: `auth-utils.ts` uses same namespace?
- Check: User has the required role/permission?
- Check: Convex function is checking the right role?

**Problem: Frontend shows admin UI but backend denies access**
- This is correct behavior! Frontend and backend are independent
- Frontend is a UX hint, backend is security enforcement
- Make sure both use the same authorization logic

**Problem: Role changes not taking effect**
- User needs to log out and back in
- Or revoke their session via Management API
- Or wait for token to expire (default: 10 hours)

## Alternative Approaches

### Option 1: Store Roles in Convex Database

**Pros:**
- Role changes take effect immediately (no re-login)
- Can query users by role efficiently
- More control over role data

**Cons:**
- Extra database query on every request
- Role data duplicated (Auth0 + Convex)
- More complex to implement
- Sync issues if Auth0 and Convex diverge

**When to use:**
- You need real-time role updates
- You need to query users by role
- You need complex role hierarchies

### Option 2: Auth0 Fine-Grained Authorization (FGA)

**Pros:**
- Very granular permissions (document-level)
- Relationship-based (e.g., "owner of article X")
- Google Zanzibar-inspired (battle-tested)
- Separate service from authentication

**Cons:**
- More complex to set up
- Requires separate API calls (not in JWT)
- Additional cost at scale
- Steeper learning curve

**When to use:**
- You need document-level permissions
- You need relationship-based auth ("owner", "shared with")
- You need dynamic permission assignments
- RBAC is too coarse-grained

### Option 3: Roll Your Own RBAC in Convex

**Pros:**
- Full control over implementation
- No Auth0 dependency for roles
- Can optimize for your specific needs

**Cons:**
- More code to write and maintain
- Security burden on you
- Need to build admin UI
- Won't work for iOS app (different backend)

**When to use:**
- You have very specific requirements
- You don't want Auth0 dependency
- You have time to build and maintain

## Estimated Effort

### Implementation Time

| Phase | Estimated Time | Complexity |
|-------|---------------|------------|
| Auth0 Setup (Dashboard) | 1-2 hours | Low |
| Auth0 Actions (Token claims) | 30 minutes | Low |
| Frontend utilities | 2-3 hours | Medium |
| Backend utilities | 1-2 hours | Medium |
| Update existing components | 3-4 hours | Medium |
| Testing | 2-3 hours | Medium |
| Documentation | 1-2 hours | Low |
| **Total** | **11-17 hours** | **Medium** |

### Maintenance Burden

- **Ongoing:** Low (mostly Auth0 Dashboard management)
- **Code changes for new roles:** None (just Auth0 Dashboard)
- **Code changes for new permissions:** Minimal (just add to utility functions)

## Recommendations

### For Sora Specifically

**Phase 1 (Now): Start Simple**
- Implement just 2 roles: `admin` and `user`
- Admin gets access to analytics, user management
- User gets standard access to their own data
- No permissions yet, just roles

**Phase 2 (Future): Add Permissions**
- When you need fine-grained control
- Example: Different permission levels for shared articles
- Or when building team/organization features

**Phase 3 (Maybe): Consider FGA**
- If you need document-level permissions
- Example: "User A can edit Article X because they're collaborator"
- Or relationship-based permissions

### Implementation Order

1. ✅ **Do first:** Auth0 setup (Dashboard)
2. ✅ **Do first:** Auth0 Actions (add roles to tokens)
3. ✅ **Do first:** Backend authorization (security critical)
4. ⏳ **Do second:** Frontend utilities and hooks
5. ⏳ **Do second:** Update existing components to check roles
6. 📅 **Do later:** Admin UI for managing roles (use Dashboard for now)
7. 📅 **Do later:** Analytics and audit logging

## Resources

**Official Documentation:**
- [Auth0 RBAC Overview](https://auth0.com/docs/manage-users/access-control/rbac)
- [Auth0 Actions](https://auth0.com/docs/customize/actions)
- [Custom Claims](https://auth0.com/docs/secure/tokens/json-web-tokens/create-custom-claims)
- [Management API - Roles](https://auth0.com/docs/api/management/v2#!/Roles/get_roles)

**Example Code:**
- [Auth0 React SDK Examples](https://github.com/auth0/auth0-react/blob/main/EXAMPLES.md)
- [Auth0 Actions Examples](https://github.com/auth0/actions-gallery)

**Related:**
- [Auth0 FGA Documentation](https://fga.dev) (for fine-grained authorization)
- [JWT.io](https://jwt.io) (for debugging tokens)

## Next Steps

**If you decide to implement this:**

1. Read this document fully
2. Set up a test Auth0 tenant (free) to experiment
3. Start with Phase 1 (Auth0 Setup)
4. Test with multiple users before rolling out
5. Consider gradual rollout (admin features first)
6. Monitor Auth0 logs for issues

**Questions to answer before starting:**

- What roles do you actually need? (start minimal)
- Which features should be admin-only?
- Do you need permissions or just roles? (roles are simpler)
- How will you assign the first admin? (manual in Dashboard is fine)
- Do you need role changes to apply immediately? (affects architecture)

---

**Document Version:** 1.0
**Last Updated:** 2025-01-06
**Author:** Claude
**Status:** Planning Document - Not Yet Implemented
