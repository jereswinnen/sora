# Testing Convex Functions

Quick guide to test the article management functions.

## Prerequisites

Make sure `npx convex dev` is running in a terminal. It should auto-deploy your functions.

---

## 1. Create a Test User

First, you need to sign up a user. You can do this via the Convex dashboard or by implementing a simple signup endpoint (we'll do this in Phase 5).

For now, let's test with the Convex dashboard:

1. Open https://dashboard.convex.dev
2. Navigate to your project
3. Go to "Data" tab
4. You should see your tables

---

## 2. Test Functions via Convex Dashboard

### Test: saveArticle (Action)

```bash
npx convex run articles:saveArticle '{
  "url": "https://example.com",
  "tags": ["test", "example"]
}'
```

**Expected:** Returns an article ID

**Note:** This will fail with "Not authenticated" unless you're authenticated. We'll fix this in Phase 5 when we add API routes with auth.

### Test: listArticles (Query)

```bash
npx convex run articles:listArticles '{
  "limit": 10
}'
```

**Expected:** Returns array of articles (empty if none saved yet)

### Test: listArticles with tag filter

```bash
npx convex run articles:listArticles '{
  "tag": "test",
  "limit": 10
}'
```

**Expected:** Returns articles tagged with "test"

### Test: getArticle (Query)

```bash
npx convex run articles:getArticle '{
  "articleId": "your-article-id-here"
}'
```

**Expected:** Returns the article object

### Test: addTag (Mutation)

```bash
npx convex run articles:addTag '{
  "articleId": "your-article-id-here",
  "tag": "important"
}'
```

**Expected:** Returns `{ success: true }`

### Test: removeTag (Mutation)

```bash
npx convex run articles:removeTag '{
  "articleId": "your-article-id-here",
  "tag": "test"
}'
```

**Expected:** Returns `{ success: true }`

### Test: updateArticle (Mutation)

```bash
npx convex run articles:updateArticle '{
  "articleId": "your-article-id-here",
  "readAt": 1234567890,
  "archived": false
}'
```

**Expected:** Returns `{ success: true }`

### Test: deleteArticle (Mutation)

```bash
npx convex run articles:deleteArticle '{
  "articleId": "your-article-id-here"
}'
```

**Expected:** Returns `{ success: true }`

---

## 3. Test Parser Directly

To test the parser independently:

```bash
# This won't work directly since it's not exported as a function
# But you can test it by calling saveArticle with a real URL
```

---

## 4. Expected Errors (Before Auth)

Since authentication isn't wired up yet, you'll see:

```
Error: Not authenticated
```

This is **expected** and **correct**! It means the auth guards are working.

---

## Next Steps

In Phase 5, we'll:
1. Implement API routes that handle authentication
2. Add client-side React components for testing
3. Build a simple UI to test the full flow

For now, the functions are deployed and ready. You can verify they exist:

```bash
npx convex dashboard
# Go to "Functions" tab - you should see all the articles functions listed
```

---

## Troubleshooting

### "Function not found"
- Make sure `npx convex dev` is running
- Check the terminal for deployment errors
- Run `npx convex dev --once` to force a deployment

### "Schema validation error"
- Check that all required fields are provided
- Check that field types match (string, number, etc.)

### "Not authenticated"
- Expected! We'll wire up auth in Phase 5
- For now, this confirms the auth guards are working
