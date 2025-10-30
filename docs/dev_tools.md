# Development Tools

This document describes the development/debugging tools available for Sora.

## Overview

The dev tools are implemented in `convex/devTools.ts` and provide terminal commands for:
- **Clear Database**: Remove all data except users
- **Add Dummy Data**: Parse and save articles from real URLs

**Safety**: Both commands require the `DEV_TOOLS_ENABLED` environment variable to be set. This is a per-deployment setting, so you can safely enable it on your development deployment without affecting production.

## Setup (One-Time)

Before using dev tools, you must enable them on your Convex deployment:

```bash
npx convex env set DEV_TOOLS_ENABLED true
```

**Important**: This setting is per-deployment. When you create a production deployment later, don't set this variable there. Your current deployment is for development only, so it's safe to enable.

**To disable dev tools later** (e.g., if you promote this deployment to production):
```bash
npx convex env unset DEV_TOOLS_ENABLED
```

## Prerequisites

- `npx convex dev` must be running in a separate terminal
- Dev tools must be enabled (see Setup above)
- For `addDummyData`: At least one user must exist in the database (sign up in the app first)

## Clear Database

Removes all articles, tags, and user preferences from the database while keeping users intact.

### Usage

**Using npm script (recommended):**
```bash
pnpm db:clear
```

**Using Convex CLI directly:**
```bash
npx convex run devTools:clearDatabase '{"confirm": "YES_DELETE_ALL_DATA"}'
```

**Safety features:**
- Requires explicit confirmation string: `"YES_DELETE_ALL_DATA"`
- Only works when `DEV_TOOLS_ENABLED=true` is set
- Keeps all users intact (only removes articles, tags, and preferences)

**Output:**
```
Starting database clear (keeping users)...
Deleted 15 articles
Deleted 8 tags
Deleted 1 user preferences
Database cleared successfully!
```

## Add Dummy Data

Fetches and parses articles from real URLs, saving them to the database with tags.

By default, it will add 5 curated programming/tech articles with tags `["demo", "test"]`. You can also provide your own URLs and tags.

### Usage

**Using npm script (uses defaults):**
```bash
pnpm db:seed
```

**Using Convex CLI:**
```bash
# Use defaults (5 curated articles with demo/test tags)
npx convex run devTools:addDummyData

# Or provide custom URLs and tags
npx convex run devTools:addDummyData '{
  "urls": ["https://example.com/article1", "https://example.com/article2"],
  "tags": ["custom", "my-tag"]
}'
```

**What it does:**
1. Finds the first user in your database (the one you signed up with)
2. Fetches each URL using the article parser
3. Extracts title, content, author, images, etc.
4. Saves the article to that user's account
5. Associates the provided tags (if any)
6. Reports success/failure for each URL

**Output:**
```
Adding 3 dummy articles for user: j57abc123...
Fetching: https://paulgraham.com/founder.html
Parsed successfully: "What I Wish Someone Had Told Me" by Paul Graham
✓ Successfully saved: https://paulgraham.com/founder.html
Fetching: https://www.joelonsoftware.com/2000/08/09/...
Parsed successfully: "The Joel Test" by Joel Spolsky
✓ Successfully saved: https://www.joelonsoftware.com/2000/08/09/...
...

Dummy data generation complete!
Successful: 3/3
```

**Safety features:**
- Only works when `DEV_TOOLS_ENABLED=true` is set
- Requires at least one user in the database
- Each URL is parsed independently (one failure won't stop others)
- Returns detailed error messages for failed URLs

## Example Workflow

Here's a typical development workflow:

```bash
# One-time setup: Enable dev tools
npx convex env set DEV_TOOLS_ENABLED true

# Terminal 1: Start Convex backend
npx convex dev

# Terminal 2: Clear and reseed database
pnpm db:clear
pnpm db:seed

# Or do both at once
pnpm db:reset
```

## Customizing Default URLs

Want to change the default articles? Edit `convex/devTools.ts`:

```typescript
const DEFAULT_DUMMY_URLS = [
  "https://your-favorite-blog.com/article1",
  "https://your-favorite-blog.com/article2",
  // Add your own URLs here
];

const DEFAULT_DUMMY_TAGS = ["your", "custom", "tags"];
```

**Tips for choosing URLs:**
- Choose articles with clear structure (headings, paragraphs)
- Avoid paywalled or JavaScript-heavy sites
- Use articles you'd actually want to read in the app
- Paul Graham essays and tech blogs generally parse well

## Troubleshooting

**"Dev tools are not enabled" error:**
- Run `npx convex env set DEV_TOOLS_ENABLED true` to enable dev tools
- Make sure `npx convex dev` is running so the environment variable takes effect
- This is safe to do on your development deployment

**"No users found in database" error:**
- The `addDummyData` command needs at least one user to exist
- Open the web app at http://localhost:3000 and create an account
- Then try the command again

**"Article already saved" error when seeding:**
- The URL already exists in your database
- Clear the database first with `pnpm db:clear`
- Or use different URLs

**Parser fails for a URL:**
- Some sites block scrapers or have complex JavaScript
- Try a different article or check the site's structure
- The parser works best with standard blog/article formats

## Production Safety

**How this works with multiple deployments:**

1. **Development deployment** (what you have now): Safe to enable dev tools
   ```bash
   npx convex env set DEV_TOOLS_ENABLED true
   ```

2. **Production deployment** (future): Never enable dev tools
   - When you create a production deployment, don't set this variable
   - Dev tools will be disabled by default
   - Each deployment has its own environment variables

**If you accidentally enable dev tools in production:**
```bash
# Switch to production deployment and run:
npx convex env unset DEV_TOOLS_ENABLED
```

The confirmation string (`YES_DELETE_ALL_DATA`) provides an additional safety layer even if dev tools are enabled.
