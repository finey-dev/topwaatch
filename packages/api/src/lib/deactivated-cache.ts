import type { Db } from "@topwaatch/db";
import { user } from "@topwaatch/db/schema/auth";
import { eq } from "drizzle-orm";

const CACHE_TTL_MS = 60_000;

type CacheEntry = {
  deactivatedAt: Date | null;
  expiresAt: number;
};

declare global {
  // eslint-disable-next-line no-var
  var __topwaatchDeactivatedCache: Map<string, CacheEntry> | undefined;
}

function getCache(): Map<string, CacheEntry> {
  if (!globalThis.__topwaatchDeactivatedCache) {
    globalThis.__topwaatchDeactivatedCache = new Map();
  }
  return globalThis.__topwaatchDeactivatedCache;
}

/** Returns true when the account is deactivated. Cached briefly to cut per-request DB reads. */
export async function isUserDeactivated(db: Db, userId: string): Promise<boolean> {
  const cache = getCache();
  const now = Date.now();
  const hit = cache.get(userId);
  if (hit && hit.expiresAt > now) {
    return hit.deactivatedAt !== null;
  }

  const row = await db.query.user.findFirst({
    where: eq(user.id, userId),
    columns: { deactivatedAt: true },
  });

  const deactivatedAt = row?.deactivatedAt ?? null;
  cache.set(userId, { deactivatedAt, expiresAt: now + CACHE_TTL_MS });
  return deactivatedAt !== null;
}

export function invalidateDeactivatedCache(userId: string): void {
  getCache().delete(userId);
}
