import type { ScrapeResult } from "./scrape";

const TTL_MS = 120_000;
const MAX_ENTRIES = 200;

type CacheEntry = {
  result: ScrapeResult;
  expiresAt: number;
};

const cache = new Map<string, CacheEntry>();

function prune(): void {
  const now = Date.now();
  for (const [key, entry] of cache) {
    if (entry.expiresAt <= now) cache.delete(key);
  }
  while (cache.size > MAX_ENTRIES) {
    const oldest = cache.keys().next().value;
    if (oldest === undefined) break;
    cache.delete(oldest);
  }
}

/** Store a scrape result for a short window so SSE can send a compact done event. */
export function storeScrapeResult(result: ScrapeResult): string {
  prune();
  const id = crypto.randomUUID();
  cache.set(id, { result, expiresAt: Date.now() + TTL_MS });
  return id;
}

export function takeScrapeResult(id: string): ScrapeResult | null {
  const entry = cache.get(id);
  if (!entry) return null;
  cache.delete(id);
  if (entry.expiresAt <= Date.now()) return null;
  return entry.result;
}
