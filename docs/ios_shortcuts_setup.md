# iOS Shortcuts Setup Guide

This guide shows you how to save articles to Sora from your iPhone using the Shortcuts app.

## Step 1: Get Your Auth0 User ID

1. Open your Sora web app in a browser and log in
2. Open the browser's developer console:
   - Safari: Develop > Show JavaScript Console (enable Developer menu in Safari preferences first)
   - Chrome: View > Developer > JavaScript Console
3. In the console, type: `localStorage`
4. Look for your Auth0 user ID - it should look like: `auth0|690ce93f5124e5c8ba7134e3`
5. **Copy this ID** - you'll need it in the next step

## Step 2: Configure the API Key and User ID

1. Open `/convex/http.ts` in your code editor
2. Find the `USER_ID_MAP` object (around line 29)
3. Replace the example values:

```typescript
const USER_ID_MAP: Record<string, string> = {
  // Replace these with your actual values
  "my-secret-api-key-2024": "auth0|690ce93f5124e5c8ba7134e3",
};
```

**Tips for creating a good API key:**
- Use a long random string (at least 32 characters)
- You can generate one with: `openssl rand -base64 32` (in Terminal)
- Or just make up a long random string
- Keep it secret! Don't commit it to public repos

4. Save the file

## Step 3: Deploy to Convex

Run this in your terminal to deploy the HTTP endpoint:

```bash
npx convex dev --once
```

Or if your Convex dev server is already running, it will auto-deploy.

## Step 4: Get Your Convex URL

Your API endpoint URL will be:

```
https://YOUR-DEPLOYMENT.convex.cloud/shortcuts/save-article
```

To find your Convex URL:
1. Check your `.env.local` file for `NEXT_PUBLIC_CONVEX_URL`
2. Or visit your Convex dashboard at https://dashboard.convex.dev
3. It should look like: `https://happy-animal-123.convex.cloud`

Your full endpoint URL will be that URL + `/shortcuts/save-article`

Example: `https://happy-animal-123.convex.cloud/shortcuts/save-article`

## Step 5: Create the iOS Shortcut

### Quick Setup (Recommended)

1. On your iPhone, open Safari and go to this guide
2. Long-press the shortcut below and select "Download"
3. Install the shortcut when prompted

[Download "Save to Sora" Shortcut](#) *(Coming soon)*

### Manual Setup

1. Open the **Shortcuts** app on your iPhone
2. Tap the **+** button to create a new shortcut
3. Name it "Save to Sora"
4. Add the following actions:

#### Action 1: Get Current URL
- Tap **+** > Search for "**Get URLs from Input**"
- Set input to: **Shortcut Input**

#### Action 2: Make HTTP Request
- Tap **+** > Search for "**Get Contents of URL**"
- Configure:
  - **URL**: Your endpoint (e.g., `https://happy-animal-123.convex.cloud/shortcuts/save-article`)
  - **Method**: `POST`
  - **Headers**: Add header
    - **Key**: `X-API-Key`
    - **Value**: Your API key (from Step 2)
  - **Headers**: Add another header
    - **Key**: `Content-Type`
    - **Value**: `application/json`
  - **Request Body**: `JSON`
  - Tap **Request Body** and structure it as:
    ```json
    {
      "url": "URLs from Input"
    }
    ```

#### Action 3: Show Notification
- Tap **+** > Search for "**Show Notification**"
- Set the text to: `Article saved to Sora!`

5. Tap **Done** to save the shortcut

## Step 6: Use the Shortcut

### From Safari
1. Open an article in Safari
2. Tap the **Share** button
3. Scroll down and tap "**Save to Sora**"
4. Wait for the "Article saved to Sora!" notification

### From the Shortcuts App
1. Open **Shortcuts** app
2. Tap "**Save to Sora**"
3. It will save the current Safari page

### From Siri
1. Say: "**Hey Siri, Save to Sora**"
2. It will save the currently open Safari page

### Add to Home Screen
1. Open **Shortcuts** app
2. Long-press "**Save to Sora**"
3. Tap **Add to Home Screen**
4. Now you can tap the icon to save the current page

## Advanced: Add Tags Support

To save articles with tags, modify the HTTP request body in your shortcut:

1. Edit your shortcut
2. Before the "Get Contents of URL" action, add:
   - **Ask for Input** > "Enter tags (comma-separated)"
   - Store in variable: `Tags Input`
3. Modify the Request Body JSON:
   ```json
   {
     "url": "URLs from Input",
     "tags": ["Split Tags Input by comma"]
   }
   ```

Now when you run the shortcut, it will prompt for tags!

## Troubleshooting

### "Invalid API key" error
- Check that your API key in the shortcut matches the one in `USER_ID_MAP`
- Make sure you deployed the changes with `npx convex dev --once`

### "Missing X-API-Key header" error
- Verify the header key is exactly: `X-API-Key` (case-sensitive)
- Check that the header value is your actual API key

### "Article already saved" error
- This is normal! The article already exists in your library
- You can still open it in the Sora web app

### "Failed to save article" error
- Check that the URL is valid and accessible
- Some sites block automated parsing (paywalls, etc.)
- Check Convex logs for more details: https://dashboard.convex.dev

### Article saves but doesn't appear
- Make sure your user ID in `USER_ID_MAP` matches your Auth0 user ID exactly
- Check the Convex dashboard to verify the article was saved

## Security Notes

- Your API key should be kept secret
- Don't share your shortcut with the API key embedded
- If your API key is compromised, just change it in `USER_ID_MAP` and redeploy
- Consider using a password manager to store your API key

## Next Steps

- Create different shortcuts for different workflows (e.g., "Save and Archive")
- Add Siri phrases for hands-free saving
- Create a widget to quick-save from your home screen
