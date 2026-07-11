/**
 * Tiny in-process TTL cache for Febbox resolve.
 * Good enough for early single-node scale; swap for Redis when multi-instance.
 */

type Entry<T> = { value: T; expiresAt: number };

export class TtlCache<T> {
  private store = new Map<string, Entry<T>>();

  constructor(
    private readonly defaultTtlMs: number,
    private readonly maxEntries = 2_000,
  ) {}

  get(key: string): T | undefined {
    const hit = this.store.get(key);
    if (!hit) return undefined;
    if (Date.now() > hit.expiresAt) {
      this.store.delete(key);
      return undefined;
    }
    return hit.value;
  }

  set(key: string, value: T, ttlMs = this.defaultTtlMs): void {
    if (this.store.size >= this.maxEntries) {
      // Drop oldest ~10% (Map insertion order)
      const drop = Math.max(1, Math.floor(this.maxEntries * 0.1));
      let i = 0;
      for (const k of this.store.keys()) {
        this.store.delete(k);
        if (++i >= drop) break;
      }
    }
    this.store.set(key, { value, expiresAt: Date.now() + ttlMs });
  }

  /** Return cached value or compute+store. */
  async getOrSet(
    key: string,
    compute: () => Promise<T>,
    ttlMs = this.defaultTtlMs,
  ): Promise<T> {
    const cached = this.get(key);
    if (cached !== undefined) return cached;
    const value = await compute();
    this.set(key, value, ttlMs);
    return value;
  }
}

/** Showbox search / share keys  stable metadata, longer TTL. */
export const febboxMetaCache = new TtlCache<unknown>(30 * 60_000, 3_000);

/**
 * Resolved stream payloads include IP/time-signed CDN URLs.
 * Short TTL + must be keyed by ui fingerprint (same account / same egress).
 */
export const febboxStreamCache = new TtlCache<unknown>(3 * 60_000, 1_500);

/** Failed lookups  brief negative cache to avoid stampeding Showbox. */
export const febboxNegativeCache = new TtlCache<true>(30_000, 1_000);

const rateBuckets = new Map<string, number[]>();

/** Sliding window: default 40 resolve calls / minute / IP. */
export function checkFebboxResolveRateLimit(
  ip: string,
  limit = 40,
  windowMs = 60_000,
): boolean {
  const key = `febbox:${ip || "unknown"}`;
  const now = Date.now();
  const stamps = (rateBuckets.get(key) ?? []).filter((t) => now - t < windowMs);
  if (stamps.length >= limit) {
    rateBuckets.set(key, stamps);
    return false;
  }
  stamps.push(now);
  rateBuckets.set(key, stamps);
  return true;
}
