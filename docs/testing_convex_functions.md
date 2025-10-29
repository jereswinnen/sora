# Testing Sora End-to-End

Complete guide to testing the article management MVP through the web interface.

---

## Prerequisites

1. **Convex backend running:**
   ```bash
   npx convex dev
   ```
   Keep this running in a terminal.

2. **Next.js development server running:**
   ```bash
   pnpm dev
   ```
   Keep this running in another terminal.

---

## Testing Flow

### 1. Sign Up for an Account

1. Open http://localhost:3000 in your browser
2. You'll be redirected to the `/auth` page
3. Click "Don't have an account? Sign up"
4. Enter an email and password
5. Click "Sign Up"
6. You'll be redirected to the dashboard

**What's happening:**
- Convex Auth creates a new user account
- A session token is generated
- You're authenticated and can access protected routes

---

### 2. Save Your First Article

On the dashboard:

1. Enter a URL in the "Article URL" field
   - Try: `https://example.com`
   - Or any article URL you want to save
2. (Optional) Add tags: `test, example`
3. Click "Save Article"

**What's happening:**
- Frontend calls `saveArticle` action
- Convex fetches the URL
- Parser extracts title, content, metadata, images
- Article is saved to your account's articles table
- Dashboard refreshes to show the new article

**Expected result:**
- Green success message: "Article saved successfully!"
- Article appears in the list below

---

### 3. View Article Details

In the articles list, you'll see:
- **Title** - Extracted from the page
- **URL** - The original link
- **Excerpt** - First 300 characters
- **Author** - If found in meta tags
- **Tags** - Any tags you added
- **Saved date** - When you saved it

---

### 4. Test Article Operations

For each article, you can:

#### Add a Tag
1. Click "Add Tag" button
2. Enter a tag name (e.g., "important")
3. Click "Add"

**What's happening:** `addTag` mutation adds the tag to the article

#### Mark as Read
1. Click "Mark Read" button
2. Read date appears next to "Saved"

**What's happening:** `updateArticle` mutation sets `readAt` timestamp

#### Archive Article
1. Click "Archive" button
2. Article shows "Archived" status

**What's happening:** `updateArticle` mutation sets `archived: true`

#### Delete Article
1. Click "Delete" button
2. Confirm the deletion
3. Article is removed from the list

**What's happening:** `deleteArticle` mutation removes the article from database

---

### 5. Test Multiple Articles

Save several articles to test:
- List view with multiple items
- Filtering by tags (coming in future updates)
- Different article types (blogs, news, documentation)

---

### 6. Sign Out and Sign Back In

1. Click "Sign Out" button (top right)
2. You'll be redirected to `/auth`
3. Sign in with your email and password
4. Your articles are still there!

**What's happening:**
- Session is cleared
- Sign in creates a new session
- Articles are associated with your user ID, so they persist

---

## Testing Different URLs

Try parsing different types of content:

### Simple HTML
```
https://example.com
```

### News Articles
```
https://news.ycombinator.com
```

### Blog Posts
```
https://blog.example.com/some-post
```

### Technical Documentation
```
https://nextjs.org/docs
```

**Parser will extract:**
- ✅ Title from `<title>`, `og:title`, or `<h1>`
- ✅ Content from `<article>`, `<main>`, or `<body>`
- ✅ Images from `og:image` or `twitter:image`
- ✅ Author from meta tags
- ✅ Published date if available

---

## Troubleshooting

### "Authentication failed"
- Check that Convex dev server is running (`npx convex dev`)
- Check browser console for errors
- Try refreshing the page

### "Failed to save article"
- Check that the URL is valid and accessible
- Check Convex logs in terminal for parser errors
- Some sites block bots - try a different URL

### "Article already saved"
- You've already saved this URL
- This is expected - prevents duplicates
- Try a different URL

### Articles not appearing
- Check browser console for errors
- Check that you're authenticated (see user info in Convex dashboard)
- Refresh the page

### Parser returns "Untitled"
- The page might not have proper meta tags
- Parser falls back to basic extraction
- Content will still be saved, just without a good title

---

## Verifying in Convex Dashboard

You can also verify data directly:

1. Open https://dashboard.convex.dev
2. Go to your project
3. Click "Data" tab
4. View tables:
   - `articles` - See all saved articles
   - `authSessions` - See active sessions
   - `users` - See user accounts (yours!)

---

## Testing Checklist

- [ ] Sign up for new account
- [ ] Sign in with existing account
- [ ] Save article from URL
- [ ] View article details
- [ ] Add tag to article
- [ ] Mark article as read
- [ ] Archive article
- [ ] Delete article
- [ ] Sign out
- [ ] Sign back in
- [ ] Verify articles persist

---

## Next Steps

All core MVP functionality is working! 🎉

Future enhancements:
- Filter articles by tag
- Search articles
- Mark as unread / unarchive
- Export articles
- Reading lists
- Book tracking
- Highlights and notes

---

## Development Tips

### Hot Reload
- Convex functions hot reload automatically with `npx convex dev`
- Next.js pages hot reload with `pnpm dev`
- Changes appear instantly without restart

### Debugging
- Browser DevTools Console - Frontend errors
- Convex dev terminal - Backend function logs
- Convex Dashboard - Database state

### Making Changes
1. Edit Convex functions in `convex/articles.ts`
2. Edit UI in `src/app/dashboard/page.tsx`
3. Changes deploy automatically
4. Refresh browser to see updates
