import "dotenv/config";
import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

export const env = createEnv({
  server: {
    DATABASE_URL: z.string().min(1),
    BETTER_AUTH_SECRET: z.string().min(32),
    BETTER_AUTH_URL: z.url(),
    CORS_ORIGIN: z.url(),
    NODE_ENV: z.enum(["development", "production", "test"]).default("development"),

    // Scraper / proxy
    PROXY_DEFAULT_URL: z
      .string()
      .url()
      .default("https://proxy.topwaatch.mov/proxy"),
    M3U8_PROXY_DEFAULT_URL: z
      .string()
      .url()
      .default("https://proxy.topwaatch.mov"),
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
