import { z } from "zod";

/**
 * Validation schemas for API requests and responses
 */

// ============================================================================
// Request Schemas
// ============================================================================

/**
 * Schema for saving a new article
 * POST /api/articles
 */
export const SaveArticleSchema = z.object({
  url: z.string().url("Must be a valid URL"),
  tags: z.array(z.string()).optional(),
});

/**
 * Schema for listing articles with filters
 * GET /api/articles?tag=tech&limit=50
 */
export const ListArticlesSchema = z.object({
  tag: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional().default(50),
  archived: z.coerce.boolean().optional(),
});

/**
 * Schema for adding a tag to an article
 * PATCH /api/articles/[id]
 */
export const AddTagSchema = z.object({
  tag: z.string().min(1, "Tag cannot be empty"),
});

/**
 * Schema for updating article status
 * PATCH /api/articles/[id]
 */
export const UpdateArticleSchema = z.object({
  readAt: z.number().optional(),
  archived: z.boolean().optional(),
  tags: z.array(z.string()).optional(),
});

// ============================================================================
// Response Schemas
// ============================================================================

/**
 * Schema for article responses from the API
 */
export const ArticleResponseSchema = z.object({
  _id: z.string(),
  _creationTime: z.number().optional(),
  userId: z.string(),
  url: z.string().url(),
  title: z.string(),
  content: z.string(),
  excerpt: z.string().optional(),
  imageUrl: z.string().url().optional(),
  author: z.string().optional(),
  publishedAt: z.number().optional(),
  savedAt: z.number(),
  readAt: z.number().optional(),
  archived: z.boolean().optional(),
  tags: z.array(z.string()),
});

/**
 * Schema for tag responses
 */
export const TagResponseSchema = z.object({
  _id: z.string(),
  userId: z.string(),
  name: z.string(),
  color: z.string().optional(),
  createdAt: z.number(),
});

/**
 * Schema for error responses
 */
export const ErrorResponseSchema = z.object({
  error: z.string(),
  details: z.unknown().optional(),
});

// ============================================================================
// Type Exports
// ============================================================================

export type SaveArticleInput = z.infer<typeof SaveArticleSchema>;
export type ListArticlesInput = z.infer<typeof ListArticlesSchema>;
export type AddTagInput = z.infer<typeof AddTagSchema>;
export type UpdateArticleInput = z.infer<typeof UpdateArticleSchema>;

export type Article = z.infer<typeof ArticleResponseSchema>;
export type Tag = z.infer<typeof TagResponseSchema>;
export type ErrorResponse = z.infer<typeof ErrorResponseSchema>;
