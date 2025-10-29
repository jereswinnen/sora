# Convex Development Workflow

Quick reference guide for working with Convex in the Sora project.

## Installation

```bash
pnpm install convex @convex-dev/auth @auth/core@0.37.0
pnpm install -D convex
```

## Core Commands

### Development
```bash
npx convex dev
```
- Starts local development server
- Creates project on first run (follow interactive prompts)
- Watches files and auto-deploys changes
- Sets `NEXT_PUBLIC_CONVEX_URL` (or `VITE_CONVEX_URL`) in environment

### Production Deployment
```bash
npx convex deploy
```
- Deploys backend to production
- First run auto-provisions production deployment
- Use `CONVEX_DEPLOY_KEY` env var for CI/CD or staging

### Deploy with Pre-build Command
```bash
npx convex deploy --cmd "npm run build"
```
- Runs build before deploying
- `CONVEX_URL` available to command

### Help & Documentation
```bash
npx convex -h        # CLI help
npx convex docs      # Open docs
```

---

## Convex Auth Setup

### 1. Generate JWT Keys

Create a script to generate RSA256 key pair:

```bash
node generate-keys.mjs
```

**generate-keys.mjs:**
```js
import { exportJWK, exportPKCS8, generateKeyPair } from "jose";

const keys = await generateKeyPair("RS256", { extractable: true });
const privateKey = await exportPKCS8(keys.privateKey);
const publicKey = await exportJWK(keys.publicKey);
const jwks = JSON.stringify({ keys: [{ use: "sig", ...publicKey }] });

console.log(`JWT_PRIVATE_KEY="${privateKey.trimEnd().replace(/\n/g, " ")}"`);
console.log(`JWKS=${jwks}`);
```

### 2. Set Environment Variables

```bash
npx convex env set JWT_PRIVATE_KEY "<your-private-key>"
npx convex env set JWKS '<your-jwks-json>'
npx convex env set SITE_URL http://localhost:3000
```

**For OAuth providers (GitHub example):**
```bash
npx convex env set AUTH_GITHUB_ID <your-client-id>
npx convex env set AUTH_GITHUB_SECRET <your-client-secret>
```

### 3. Configure `convex/auth.ts`

```typescript
import { convexAuth } from "@convex-dev/auth/server";
import GitHub from "@auth/core/providers/github";
import { Password } from "@convex-dev/auth/providers/Password";

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [
    GitHub,
    Password,
  ],
});
```

### 4. Add HTTP Routes in `convex/http.ts`

```typescript
import { httpRouter } from "convex/server";
import { auth } from "./auth";

const http = httpRouter();

auth.addHttpRoutes(http); // Adds /.well-known/*, /api/auth/* routes

export default http;
```

### 5. Update `convex/tsconfig.json`

```json
{
  "compilerOptions": {
    "skipLibCheck": true,
    "moduleResolution": "Bundler"
  }
}
```

---

## Available Auth Providers

**OAuth:**
- GitHub: `@auth/core/providers/github`
- Google: `@auth/core/providers/google`
- Apple: `@auth/core/providers/apple`

**Credential-based:**
- `Password` from `@convex-dev/auth/providers/Password`
- `Anonymous` from `@convex-dev/auth/providers/Anonymous`

**Email/Phone (OTP):**
- `Email` from `@convex-dev/auth/providers/Email`
- `Phone` from `@convex-dev/auth/providers/Phone`
- Magic links via `@auth/core/providers/resend`

---

## Client-Side Setup (Next.js)

### App Router: `app/layout.tsx`

```tsx
import { ConvexAuthNextjsServerProvider } from "@convex-dev/auth/nextjs/server";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ConvexAuthNextjsServerProvider>
      <html lang="en">
        <body>{children}</body>
      </html>
    </ConvexAuthNextjsServerProvider>
  );
}
```

### Sign In/Out

```tsx
"use client";
import { useAuthActions } from "@convex-dev/auth/react";

export function AuthButtons() {
  const { signIn, signOut } = useAuthActions();

  return (
    <>
      <button onClick={() => signIn("github")}>Sign in with GitHub</button>
      <button onClick={() => signOut()}>Sign out</button>
    </>
  );
}
```

---

## Common Utilities

### Environment Variables
```bash
npx convex env list                    # List all env vars
npx convex env set KEY value           # Set/update env var
npx convex env delete KEY              # Delete env var
```

### Data Management
```bash
npx convex data                        # List tables
npx convex import                      # Import data
npx convex export                      # Export data
```

### Logs
```bash
npx convex logs                        # Stream logs
npx convex logs --success              # Include successful executions
```

---

## Local Development Tips

- `npx convex dev --once`: Deploy once without watching
- `npx convex dev --configure`: Reconfigure project settings
- Use `CONVEX_DEPLOY_KEY` for staging/preview environments
- Local deployments are per-developer, won't affect teammates

---

## Preview Deployments

```bash
npx convex deploy --preview-create my-feature-branch
npx convex deploy --preview-run myInitFunction
```

---

## Notes

- Auth routes: `/.well-known/openid-configuration`, `/.well-known/jwks.json`, `/api/auth/signin/*`, `/api/auth/callback/*`
- Functions auto-reload during `npx convex dev`
- Production deploys with `npx convex deploy` (set up CI with `CONVEX_DEPLOY_KEY`)
- Schema changes are validated before push
