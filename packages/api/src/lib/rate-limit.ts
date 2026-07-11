import { TRPCError } from "@trpc/server";
import { env } from "@topwaatch/env/server";

const rateBuckets = new Map<string, number[]>();

/**
 * Sliding-window rate limit. Returns true if the request is allowed.
 */
export function checkRateLimit(key: string): boolean {
  const now = Date.now();
  const windowMs = 60_000;
  const limit = env.SCRAPE_RATE_LIMIT_PER_MINUTE;
  const stamps = (rateBuckets.get(key) ?? []).filter((t) => now - t < windowMs);
  if (stamps.length >= limit) {
    rateBuckets.set(key, stamps);
    return false;
  }
  stamps.push(now);
  rateBuckets.set(key, stamps);
  return true;
}

export function rateLimitKey(userId: string | null | undefined, clientIp: string): string {
  return userId ?? `ip:${clientIp || "unknown"}`;
}

export function assertRateLimit(key: string): void {
  if (!checkRateLimit(key)) {
    throw new TRPCError({
      code: "TOO_MANY_REQUESTS",
      message: "Rate limit exceeded",
    });
  }
}
