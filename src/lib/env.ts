import { z } from "zod";

/**
 * Client-side environment variables
 * These are safe to expose to the browser (prefixed with NEXT_PUBLIC_)
 */
const clientEnvSchema = z.object({
  NEXT_PUBLIC_CONVEX_URL: z.string().url("Invalid Convex URL"),
});

/**
 * Server-side environment variables
 * These are never exposed to the browser
 * Add API keys and secrets here as needed
 */
const serverEnvSchema = z.object({
  // Add server-only env vars here as needed
  // Example: RESEND_API_KEY: z.string().min(1)
});

// Validate environment variables at build/runtime
const clientEnv = clientEnvSchema.safeParse({
  NEXT_PUBLIC_CONVEX_URL: process.env.NEXT_PUBLIC_CONVEX_URL,
});

if (!clientEnv.success) {
  console.error("❌ Invalid environment variables:", clientEnv.error.flatten().fieldErrors);
  throw new Error("Invalid environment variables");
}

// Only validate server env on the server side
const serverEnv =
  typeof window === "undefined"
    ? serverEnvSchema.safeParse(process.env)
    : { success: true as const, data: {} };

if (!serverEnv.success) {
  console.error("❌ Invalid server environment variables:", serverEnv.error.flatten().fieldErrors);
  throw new Error("Invalid server environment variables");
}

/**
 * Type-safe environment variables
 */
export const env = {
  ...clientEnv.data,
  ...(typeof window === "undefined" ? serverEnv.data : {}),
} as const;
