import type { Db } from "@topwaatch/db";
import { env } from "@topwaatch/env/server";
import { TRPCError } from "@trpc/server";
import { sql } from "drizzle-orm";

const SCRAPE_PREFIX = "scrape:";
const WINDOW_MS = 60_000;

export function rateLimitKey(userId: string | null | undefined, clientIp: string): string {
  return userId ?? `ip:${clientIp || "unknown"}`;
}

/**
 * Atomic fixed-window counter in Postgres — consistent across all Vercel instances.
 * One row per key; window resets after 60s of inactivity on that key.
 */
export async function checkRateLimit(db: Db, key: string): Promise<boolean> {
  const limit = env.SCRAPE_RATE_LIMIT_PER_MINUTE;
  const fullKey = `${SCRAPE_PREFIX}${key}`;

  const result = await db.execute<{ count: number }>(sql`
    INSERT INTO rate_limit_buckets (key, window_start, count)
    VALUES (${fullKey}, NOW(), 1)
    ON CONFLICT (key) DO UPDATE SET
      count = CASE
        WHEN (EXTRACT(EPOCH FROM (NOW() - rate_limit_buckets.window_start)) * 1000) >= ${WINDOW_MS}
        THEN 1
        ELSE rate_limit_buckets.count + 1
      END,
      window_start = CASE
        WHEN (EXTRACT(EPOCH FROM (NOW() - rate_limit_buckets.window_start)) * 1000) >= ${WINDOW_MS}
        THEN NOW()
        ELSE rate_limit_buckets.window_start
      END
    RETURNING count
  `);

  const count = Number(result.rows[0]?.count ?? 1);
  return count <= limit;
}

export async function assertRateLimit(db: Db, key: string): Promise<void> {
  const allowed = await checkRateLimit(db, key);
  if (!allowed) {
    throw new TRPCError({
      code: "TOO_MANY_REQUESTS",
      message: "Rate limit exceeded",
    });
  }
}
