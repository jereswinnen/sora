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
  MAX_CONTENT_LENGTH: 500000, // 500KB - HTML is larger than plain text
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
    const content = extractContent($, url);
    const excerpt = extractExcerpt($);
    const imageUrl = extractImage($, url);
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

function extractContent($: cheerio.CheerioAPI, baseUrl: string): string {
  // Find the main content container
  const $content =
    $("article").length > 0
      ? $("article").first()
      : $("main").length > 0
        ? $("main").first()
        : $('[role="main"]').length > 0
          ? $('[role="main"]').first()
          : $("body");

  // Clone to avoid modifying original
  const $contentClone = $content.clone();

  // Remove unwanted elements from the content
  $contentClone.find("script, style, nav, header, footer, aside, iframe, noscript").remove();
  $contentClone.find(".ad, .advertisement, .social-share, .comments, .related-posts").remove();
  $contentClone.find('[class*="popup"], [class*="modal"], [class*="overlay"]').remove();

  // Remove webmentions, likes, reactions, and other social cruft
  $contentClone.find(".webmentions, .webmention, .likes, .like, .repost, .reposts, .reactions").remove();
  $contentClone.find('[class*="webmention"], [class*="like"], [class*="reaction"]').remove();
  $contentClone.find('[class*="share"], [class*="follow"], [class*="subscribe"]').remove();
  $contentClone.find('[id*="webmention"], [id*="like"], [id*="reaction"]').remove();

  // Convert relative URLs to absolute URLs
  convertRelativeUrls($contentClone, baseUrl);

  // Get the HTML content with formatting preserved
  let htmlContent = $contentClone.html() || "";

  // Basic length check (HTML will be longer than text)
  if (htmlContent.length > PARSER_CONFIG.MAX_CONTENT_LENGTH) {
    htmlContent = htmlContent.substring(0, PARSER_CONFIG.MAX_CONTENT_LENGTH) + "...";
  }

  return htmlContent.trim();
}

function extractExcerpt($: cheerio.CheerioAPI): string {
  // Find the main content container
  const $content =
    $("article").length > 0
      ? $("article").first()
      : $("main").length > 0
        ? $("main").first()
        : $('[role="main"]').length > 0
          ? $('[role="main"]').first()
          : $("body");

  // Get plain text for excerpt
  const plainText = $content.text();

  // Clean up whitespace
  const cleanText = plainText.replace(/\s+/g, " ").trim();

  // Create excerpt
  if (cleanText.length > PARSER_CONFIG.MAX_EXCERPT_LENGTH) {
    return cleanText.substring(0, PARSER_CONFIG.MAX_EXCERPT_LENGTH).trim() + "...";
  }

  return cleanText;
}

function extractImage($: cheerio.CheerioAPI, baseUrl: string): string | undefined {
  const imageUrl =
    $('meta[property="og:image"]').attr("content") ||
    $('meta[name="twitter:image"]').attr("content") ||
    $("article img, main img").first().attr("src");

  if (imageUrl) {
    const absoluteUrl = toAbsoluteUrl(imageUrl, baseUrl);
    if (absoluteUrl && isValidUrl(absoluteUrl)) {
      return absoluteUrl;
    }
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

/**
 * Convert a relative URL to an absolute URL using the base URL
 */
function toAbsoluteUrl(relativeUrl: string, baseUrl: string): string {
  try {
    // If it's already an absolute URL, return it
    if (relativeUrl.startsWith("http://") || relativeUrl.startsWith("https://")) {
      return relativeUrl;
    }

    // Handle protocol-relative URLs (//example.com/image.jpg)
    if (relativeUrl.startsWith("//")) {
      const baseUrlObj = new URL(baseUrl);
      return `${baseUrlObj.protocol}${relativeUrl}`;
    }

    // Convert relative URL to absolute
    const url = new URL(relativeUrl, baseUrl);
    return url.href;
  } catch {
    // If URL construction fails, return the original
    return relativeUrl;
  }
}

/**
 * Convert all relative URLs in images and links to absolute URLs
 */
function convertRelativeUrls($content: ReturnType<cheerio.CheerioAPI>, baseUrl: string): void {
  // Convert image src attributes
  $content.find("img").each((_, elem) => {
    const src = elem.attribs?.src;
    if (src) {
      elem.attribs.src = toAbsoluteUrl(src, baseUrl);
    }

    // Also handle srcset if present
    const srcset = elem.attribs?.srcset;
    if (srcset) {
      const newSrcset = srcset
        .split(",")
        .map((src) => {
          const parts = src.trim().split(/\s+/);
          if (parts[0]) {
            parts[0] = toAbsoluteUrl(parts[0], baseUrl);
          }
          return parts.join(" ");
        })
        .join(", ");
      elem.attribs.srcset = newSrcset;
    }
  });

  // Convert link href attributes
  $content.find("a").each((_, elem) => {
    const href = elem.attribs?.href;
    if (href && !href.startsWith("#") && !href.startsWith("mailto:") && !href.startsWith("tel:")) {
      elem.attribs.href = toAbsoluteUrl(href, baseUrl);
    }
  });
}

function isValidUrl(urlString: string): boolean {
  try {
    new URL(urlString);
    return true;
  } catch {
    return false;
  }
}
