import { useCallback, useEffect } from "react";

import {
  removeWatchHistory,
  setWatchHistory,
  watchHistoryUpdateItemToInput,
} from "@/backend/accounts/watchHistory";
import { useBackendUrl } from "@/hooks/auth/useBackendUrl";
import { AccountWithToken, useAuthStore } from "@/stores/auth";
import {
  WatchHistoryUpdateItem,
  useWatchHistoryStore,
} from "@/stores/watchHistory";

/** Low-volume writes  episode completions only. */
const SYNC_INTERVAL_MS = 60_000;

function coalesceWatchHistoryQueue(
  items: WatchHistoryUpdateItem[],
): WatchHistoryUpdateItem[] {
  const latest = new Map<string, WatchHistoryUpdateItem>();
  for (const item of items) {
    const key = item.episodeId
      ? `${item.action}:${item.tmdbId}:${item.episodeId}`
      : `${item.action}:${item.tmdbId}`;
    latest.set(key, item);
  }
  return [...latest.values()];
}

async function syncWatchHistory(
  items: WatchHistoryUpdateItem[],
  finish: (id: string) => void,
  url: string,
  account: AccountWithToken | null,
) {
  const batch = coalesceWatchHistoryQueue(items);
  for (const item of batch) {
    finish(item.id);

    if (!account) continue;

    try {
      if (item.action === "delete") {
        await removeWatchHistory(
          url,
          account,
          item.tmdbId,
          item.episodeId,
          item.seasonId,
        );
        continue;
      }

      if (item.action === "add" || item.action === "update") {
        await setWatchHistory(
          url,
          account,
          watchHistoryUpdateItemToInput(item),
        );
      }
    } catch (err) {
      console.error(
        `Failed to sync watch history: ${item.tmdbId} - ${item.action}`,
        err,
      );
    }
  }
}

export function WatchHistorySyncer() {
  const clearUpdateQueue = useWatchHistoryStore((s) => s.clearUpdateQueue);
  const removeUpdateItem = useWatchHistoryStore((s) => s.removeUpdateItem);
  const url = useBackendUrl();

  const flush = useCallback(async () => {
    if (!url) return;
    const state = useWatchHistoryStore.getState();
    if (state.updateQueue.length === 0) return;
    const user = useAuthStore.getState();
    await syncWatchHistory(
      state.updateQueue,
      removeUpdateItem,
      url,
      user.account,
    );
  }, [removeUpdateItem, url]);

  useEffect(() => {
    clearUpdateQueue();
  }, [clearUpdateQueue]);

  useEffect(() => {
    const interval = setInterval(() => {
      void flush();
    }, SYNC_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [flush]);

  useEffect(() => {
    const onHide = () => {
      void flush();
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        onHide();
      }
    };

    window.addEventListener("pagehide", onHide);
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      window.removeEventListener("pagehide", onHide);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [flush]);

  // Completions and deletes should sync soon  both are rare user-driven events.
  useEffect(() => {
    const originalAddItem = useWatchHistoryStore.getState().addItem;
    const originalRemoveItem = useWatchHistoryStore.getState().removeItem;

    useWatchHistoryStore.setState({
      addItem: (...args) => {
        originalAddItem(...args);
        void flush();
      },
      removeItem: (...args) => {
        originalRemoveItem(...args);
        void flush();
      },
    });
  }, [flush]);

  return null;
}
