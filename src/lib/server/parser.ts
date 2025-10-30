import * as cheerio from "cheerio";

/**
 * Parsed article data structure
 */
export interface ParsedArticle {
  title: string;
  content: string;
  excerpt: string;
  imageUrl?: string;
  author?: string;
  publishedAt?: number;
}

/**
 * Configuration for article parsing
 */
const PARSER_CONFIG = {
  MAX_CONTENT_LENGTH: 100000, // 100KB of text
  MAX_EXCERPT_LENGTH: 300,
  MAX_TITLE_LENGTH: 200,
  FETCH_TIMEOUT: 10000, // 10 seconds
} as const;

/**
 * Parses an article from a URL using Cheerio
 *
 * This function fetches HTML from a URL and extracts:
 * - Title (from h1, og:title, or <title>)
 * - Content (from article, main, or body)
 * - Excerpt (first 300 chars of content)
 * - Image (from og:image or twitter:image)
 * - Author (from meta tags)
 * - Published date (from meta tags)
 *
 * @param url - The URL of the article to parse
 * @returns Parsed article data
 * @throws Error if fetching or parsing fails
 */
export async function parseArticle(url: string): Promise<ParsedArticle> {
  try {
    // Fetch HTML with timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), PARSER_CONFIG.FETCH_TIMEOUT);

    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; SoraBot/1.0; +https://sora.app)",
      },
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`Failed to fetch: ${response.status} ${response.statusText}`);
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    // Extract title (try multiple sources)
    const title = extractTitle($);

    // Extract main content
    const content = extractContent($);

    // Create excerpt from content
    const excerpt = content.substring(0, PARSER_CONFIG.MAX_EXCERPT_LENGTH).trim() + "...";

    // Extract metadata
    const imageUrl = extractImage($);
    const author = extractAuthor($);
    const publishedAt = extractPublishedDate($);

    return {
      title,
      content,
      excerpt,
      imageUrl,
      author,
      publishedAt,
    };
  } catch (error) {
    if (error instanceof Error) {
      if (error.name === "AbortError") {
        throw new Error(`Request timeout: ${url} took longer than ${PARSER_CONFIG.FETCH_TIMEOUT}ms`);
      }
      throw new Error(`Failed to parse article: ${error.message}`);
    }
    throw new Error("Failed to parse article: Unknown error");
  }
}

/**
 * Extract title from various sources
 */
function extractTitle($: cheerio.CheerioAPI): string {
  // Try Open Graph title first
  let title = $('meta[property="og:title"]').attr("content");

  // Try Twitter title
  if (!title) {
    title = $('meta[name="twitter:title"]').attr("content");
  }

  // Try h1 tag
  if (!title) {
    title = $("h1").first().text();
  }

  // Fallback to page title
  if (!title) {
    title = $("title").text();
  }

  // Clean and truncate
  title = title?.trim() || "Untitled";
  return title.substring(0, PARSER_CONFIG.MAX_TITLE_LENGTH);
}

/**
 * Extract main content from article
 */
function extractContent($: cheerio.CheerioAPI): string {
  // Remove unwanted elements
  $("script, style, nav, header, footer, aside, .ad, .advertisement").remove();

  let content = "";

  // Try article tag first
  if ($("article").length > 0) {
    content = $("article").text();
  }
  // Try main tag
  else if ($("main").length > 0) {
    content = $("main").text();
  }
  // Try common content selectors
  else if ($('[role="main"]').length > 0) {
    content = $('[role="main"]').text();
  }
  // Fallback to body
  else {
    content = $("body").text();
  }

  // Clean up whitespace
  content = content
    .replace(/\s+/g, " ") // Replace multiple spaces with single space
    .replace(/\n+/g, "\n") // Replace multiple newlines with single newline
    .trim();

  // Truncate if too long
  if (content.length > PARSER_CONFIG.MAX_CONTENT_LENGTH) {
    content = content.substring(0, PARSER_CONFIG.MAX_CONTENT_LENGTH) + "...";
  }

  return content;
}

/**
 * Extract image URL from meta tags
 */
function extractImage($: cheerio.CheerioAPI): string | undefined {
  // Try Open Graph image
  let imageUrl = $('meta[property="og:image"]').attr("content");

  // Try Twitter image
  if (!imageUrl) {
    imageUrl = $('meta[name="twitter:image"]').attr("content");
  }

  // Try first img in article
  if (!imageUrl) {
    imageUrl = $("article img, main img").first().attr("src");
  }

  // Validate and return
  if (imageUrl && isValidUrl(imageUrl)) {
    return imageUrl;
  }

  return undefined;
}

/**
 * Extract author from meta tags
 */
function extractAuthor($: cheerio.CheerioAPI): string | undefined {
  // Try various author meta tags
  const author =
    $('meta[name="author"]').attr("content") ||
    $('meta[property="article:author"]').attr("content") ||
    $('meta[name="twitter:creator"]').attr("content") ||
    $('[rel="author"]').text();

  return author?.trim() || undefined;
}

/**
 * Extract published date from meta tags
 */
function extractPublishedDate($: cheerio.CheerioAPI): number | undefined {
  const dateString =
    $('meta[property="article:published_time"]').attr("content") ||
    $('meta[name="publish-date"]').attr("content") ||
    $('time[datetime]').attr("datetime");

  if (dateString) {
    const date = new Date(dateString);
    if (!isNaN(date.getTime())) {
      return date.getTime();
    }
  }

  return undefined;
}

/**
 * Check if a string is a valid URL
 */
function isValidUrl(urlString: string): boolean {
  try {
    new URL(urlString);
    return true;
  } catch {
    return false;
  }
}
