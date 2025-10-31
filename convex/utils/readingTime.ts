/**
 * Calculate estimated reading time for text content
 *
 * Uses the industry standard of 200 words per minute for average reading speed.
 *
 * @param content - The text content to analyze
 * @returns Estimated reading time in minutes (rounded up to nearest minute)
 */
export function calculateReadingTime(content: string): number {
  if (!content || content.trim().length === 0) {
    return 1; // Minimum 1 minute for empty/very short content
  }

  // Split by whitespace to count words
  const words = content.trim().split(/\s+/).length;

  // Calculate reading time at 200 words per minute, round up
  const minutes = Math.ceil(words / 200);

  // Return at least 1 minute
  return Math.max(1, minutes);
}
