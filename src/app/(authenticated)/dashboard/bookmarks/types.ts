import { Doc } from "../../../../../convex/_generated/dataModel";

/**
 * Bookmark type from Convex database
 */
export type Bookmark = Doc<"bookmarks">;

/**
 * Parsed bookmark metadata from URL
 */
export interface BookmarkMetadata {
  title: string;
  faviconUrl?: string;
  normalizedUrl: string;
}
