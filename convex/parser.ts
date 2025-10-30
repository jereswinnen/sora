import * as cheerio from "cheerio";
import { Readability } from "@mozilla/readability";
import { parseHTML } from "linkedom";

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
 * Parses an article from a URL using Mozilla Readability for content extraction
 * and Cheerio for metadata extraction. This runs in a Convex action context.
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

    // Load with Cheerio for metadata extraction
    const $ = cheerio.load(html);

    // Extract metadata using Cheerio (more reliable than Readability for meta tags)
    const metaTitle = extractTitle($);
    const imageUrl = extractImage($, url);
    const author = extractAuthor($);
    const publishedAt = extractPublishedDate($);

    // Use Readability for content extraction
    const doc = parseHTML(html).document;
    const reader = new Readability(doc, {
      keepClasses: false, // Remove class attributes for cleaner HTML
    });
    const article = reader.parse();

    if (!article) {
      throw new Error("Could not extract article content from this URL");
    }

    // Convert relative URLs in Readability output
    const contentWithAbsoluteUrls = convertUrlsInHtmlString(article.content || "", url);

    return {
      title: metaTitle || article.title || "Untitled", // Prefer meta tag title
      content: contentWithAbsoluteUrls,
      excerpt: article.excerpt || "",
      imageUrl,
      author: author || article.byline || undefined, // Prefer meta tag author
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
 * Convert all relative URLs in an HTML string to absolute URLs
 * Used for processing Readability's HTML output
 */
function convertUrlsInHtmlString(htmlString: string, baseUrl: string): string {
  const $ = cheerio.load(htmlString);

  // Convert image src attributes
  $("img").each((_, elem) => {
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
  $("a").each((_, elem) => {
    const href = elem.attribs?.href;
    if (href && !href.startsWith("#") && !href.startsWith("mailto:") && !href.startsWith("tel:")) {
      elem.attribs.href = toAbsoluteUrl(href, baseUrl);
    }
  });

  return $.html();
}

function isValidUrl(urlString: string): boolean {
  try {
    new URL(urlString);
    return true;
  } catch {
    return false;
  }
}
