import type { ProgressUpdateItem } from "@/stores/progress";

/** Stable key for coalescing pending upserts/deletes for the same title. */
export function progressQueueKey(
  item: Pick<ProgressUpdateItem, "action" | "tmdbId" | "seasonId" | "episodeId">,
): string {
  const season = item.seasonId ?? "";
  const episode = item.episodeId ?? "";
  return `${item.action}:${item.tmdbId}:${season}:${episode}`;
}

/** Keep only the latest pending change per title before hitting the network. */
export function coalesceProgressQueue(items: ProgressUpdateItem[]): ProgressUpdateItem[] {
  const latest = new Map<string, ProgressUpdateItem>();
  for (const item of items) {
    latest.set(progressQueueKey(item), item);
  }
  return [...latest.values()];
}

let flushHandler: (() => Promise<void>) | null = null;
let flushInFlight: Promise<void> | null = null;

export function registerProgressSyncFlush(handler: () => Promise<void>): void {
  flushHandler = handler;
}

/** Fire-and-forget server sync (deduped while a flush is already running). */
export function requestProgressSyncFlush(): void {
  if (!flushHandler) return;
  if (flushInFlight) return;
  flushInFlight = flushHandler().finally(() => {
    flushInFlight = null;
  });
}

/** Await any in-flight flush  used on tab hide / playback stop. */
export async function awaitProgressSyncFlush(): Promise<void> {
  if (flushInFlight) {
    await flushInFlight;
    return;
  }
  if (flushHandler) {
    await flushHandler();
  }
}
