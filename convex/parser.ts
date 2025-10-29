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
} as const;

/**
 * Parses an article from a URL using Cheerio
 * This runs in a Convex action context
 */
export async function parseArticle(url: string): Promise<ParsedArticle> {
  try {
    // Fetch HTML (Convex actions have built-in timeout)
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; SoraBot/1.0; +https://sora.app)",
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch: ${response.status} ${response.statusText}`);
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    // Extract article data
    const title = extractTitle($);
    const content = extractContent($);
    const excerpt = content.substring(0, PARSER_CONFIG.MAX_EXCERPT_LENGTH).trim() + "...";
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
      throw new Error(`Failed to parse article: ${error.message}`);
    }
    throw new Error("Failed to parse article: Unknown error");
  }
}

function extractTitle($: cheerio.CheerioAPI): string {
  const rawTitle =
    $('meta[property="og:title"]').attr("content") ||
    $('meta[name="twitter:title"]').attr("content") ||
    $("h1").first().text() ||
    $("title").text();

  const title = rawTitle?.trim() || "Untitled";
  return title.substring(0, PARSER_CONFIG.MAX_TITLE_LENGTH);
}

function extractContent($: cheerio.CheerioAPI): string {
  // Remove unwanted elements
  $("script, style, nav, header, footer, aside, .ad, .advertisement").remove();

  let rawContent = "";

  if ($("article").length > 0) {
    rawContent = $("article").text();
  } else if ($("main").length > 0) {
    rawContent = $("main").text();
  } else if ($('[role="main"]').length > 0) {
    rawContent = $('[role="main"]').text();
  } else {
    rawContent = $("body").text();
  }

  // Clean up whitespace
  let content = rawContent.replace(/\s+/g, " ").replace(/\n+/g, "\n").trim();

  if (content.length > PARSER_CONFIG.MAX_CONTENT_LENGTH) {
    content = content.substring(0, PARSER_CONFIG.MAX_CONTENT_LENGTH) + "...";
  }

  return content;
}

function extractImage($: cheerio.CheerioAPI): string | undefined {
  const imageUrl =
    $('meta[property="og:image"]').attr("content") ||
    $('meta[name="twitter:image"]').attr("content") ||
    $("article img, main img").first().attr("src");

  if (imageUrl && isValidUrl(imageUrl)) {
    return imageUrl;
  }

  return undefined;
}

function extractAuthor($: cheerio.CheerioAPI): string | undefined {
  const author =
    $('meta[name="author"]').attr("content") ||
    $('meta[property="article:author"]').attr("content") ||
    $('meta[name="twitter:creator"]').attr("content") ||
    $('[rel="author"]').text();

  return author?.trim() || undefined;
}

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

function isValidUrl(urlString: string): boolean {
  try {
    new URL(urlString);
    return true;
  } catch {
    return false;
  }
}
