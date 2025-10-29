import { ConvexHttpClient } from "convex/browser";
import { env } from "./env";

/**
 * Centralized Convex HTTP client for making queries and mutations
 * from API routes and server components
 */
export const convex = new ConvexHttpClient(env.NEXT_PUBLIC_CONVEX_URL);
