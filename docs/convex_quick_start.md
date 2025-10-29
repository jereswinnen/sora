# Convex Quick Start (Simplified)

The absolute minimal steps to get Convex authentication working.

---

## Install Dependencies

```bash
# Core auth packages
pnpm install @convex-dev/auth @auth/core@0.37.0 convex

# App dependencies
pnpm install zod cheerio

# Development only (for key generation)
pnpm install -D jose
```

---

## 1. Generate JWT Keys (One-Time Setup)

**Create `generate-keys.mjs`:**

```js
import { exportJWK, exportPKCS8, generateKeyPair } from "jose";

const keys = await generateKeyPair("RS256", { extractable: true });
const privateKey = await exportPKCS8(keys.privateKey);
const publicKey = await exportJWK(keys.publicKey);
const jwks = JSON.stringify({ keys: [{ use: "sig", ...publicKey }] });

console.log(`JWT_PRIVATE_KEY="${privateKey.trimEnd().replace(/\n/g, " ")}"`);
console.log(`JWKS=${jwks}`);
```

**Run it:**
```bash
node generate-keys.mjs
```

Keep the output handy.

---

## 2. Set Environment Variables

```bash
# Paste your keys from step 1
npx convex env set JWT_PRIVATE_KEY "-----BEGIN PRIVATE KEY----- ..."
npx convex env set JWKS '{"keys":[{"use":"sig",...}]}'

# Set your app URL
npx convex env set SITE_URL http://localhost:3000
```

---

## 3. Deploy to Convex

```bash
npx convex dev
```

This will:
- Create a Convex account (first time)
- Deploy your schema and auth setup
- Watch for changes
- Output your `NEXT_PUBLIC_CONVEX_URL`

That's it! ✅

---

## How Authentication Works

**Sign Up:**
```typescript
await signIn("password", {
  flow: "signUp",
  email: "user@example.com",
  password: "securepass123"
});
```

**Sign In:**
```typescript
await signIn("password", {
  flow: "signIn",
  email: "user@example.com",
  password: "securepass123"
});
```

**Sign Out:**
```typescript
await signOut();
```

---

## Why Do I Need JWT Keys?

Convex Auth creates session tokens (JWTs) that prove users are authenticated. The keys:
- **Private key**: Signs tokens (kept secret on Convex backend)
- **Public key (JWKS)**: Verifies tokens (can be shared publicly)

You generate these once and Convex handles everything else.

---

## What About Email Verification?

The basic `Password` provider works **without** email verification. Users can:
- Sign up with email + password
- Sign in immediately
- No confirmation emails needed

If you want email verification later, you'll add:
- `resend` package (for sending emails)
- `@oslojs/crypto` (for secure OTP codes)
- Custom provider configuration

But for MVP? Not needed! 🎉

---

## Verify It Works

```bash
# Check tables exist
npx convex data

# Expected output:
# - authAccounts
# - authSessions
# - users
# - articles
# - tags
```

---

## Next Steps

See `docs/convex_setup_instructions.md` for:
- Testing authentication
- Troubleshooting tips
- Production deployment
- Adding email verification (optional)
