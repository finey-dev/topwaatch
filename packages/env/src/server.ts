import "dotenv/config";
import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

export const env = createEnv({
  /**
   * Required by @t3-oss/env-core even when we have no client vars.
   * Without this, TypeScript treats every server key as invalidly "prefixed".
   */
  clientPrefix: "PUBLIC_",
  client: {},

  shared: {
    NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  },

  server: {
    /** Transaction-mode pooler URL (port 6543)  used by the app at runtime. */
    DATABASE_URL: z.string().min(1),
    /** Direct Postgres URL (port 5432)  optional, for drizzle-kit migrate/push. Falls back to DATABASE_URL. */
    DIRECT_DATABASE_URL: z.string().min(1).optional(),
    BETTER_AUTH_SECRET: z.string().min(32),
    BETTER_AUTH_URL: z.url(),
    CORS_ORIGIN: z.url(),

    // Scraper / proxy
    PROXY_DEFAULT_URL: z
      .string()
      .url()
      .default("https://topwaatch-proxy.fineyakwoyo.workers.dev/proxy"),
    M3U8_PROXY_DEFAULT_URL: z
      .string()
      .url()
      .default("https://topwaatch-proxy.fineyakwoyo.workers.dev"),
    TMDB_READ_API_KEY: z.string().optional(),

    // Discovery (Trakt)
    TRAKT_CLIENT_ID: z.string().optional(),
    TRAKT_CLIENT_SECRET: z.string().optional(),

    // Player status
    PLAYER_ROOM_TTL_MS: z.coerce.number().int().positive().default(30 * 60 * 1000),

    // Scrape rate limit
    SCRAPE_RATE_LIMIT_PER_MINUTE: z.coerce.number().int().positive().default(10),
  },
  runtimeEnv: process.env,
  skipValidation: !!process.env.SKIP_ENV_VALIDATION,
  emptyStringAsUndefined: true,
});
