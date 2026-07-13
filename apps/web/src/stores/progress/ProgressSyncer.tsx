import { useCallback, useEffect } from "react";

import {
  progressUpdateItemToInput,
  removeProgress,
  setProgress,
} from "@/backend/accounts/progress";
import { useBackendUrl } from "@/hooks/auth/useBackendUrl";
import { AccountWithToken, useAuthStore } from "@/stores/auth";
import { ProgressUpdateItem, useProgressStore } from "@/stores/progress";
import {
  coalesceProgressQueue,
  registerProgressSyncFlush,
} from "@/stores/progress/syncQueue";

/** Server sync interval — 2 req/min per active streamer vs ~20/min before. */
const SYNC_INTERVAL_MS = 30_000;

async function syncProgress(
  items: ProgressUpdateItem[],
  finish: (id: string) => void,
  url: string,
  account: AccountWithToken | null,
) {
  const batch = coalesceProgressQueue(items);
  for (const item of batch) {
    finish(item.id);

    if (!account) continue;

    try {
      if (item.action === "delete") {
        await removeProgress(
          url,
          account,
          item.tmdbId,
          item.seasonId,
          item.episodeId,
        );
        continue;
      }

      if (item.action === "upsert") {
        await setProgress(url, account, progressUpdateItemToInput(item));
      }
    } catch (err) {
      console.error(
        `Failed to sync progress: ${item.tmdbId} - ${item.action}`,
        err,
      );
    }
  }
}

export function ProgressSyncer() {
  const clearUpdateQueue = useProgressStore((s) => s.clearUpdateQueue);
  const removeUpdateItem = useProgressStore((s) => s.removeUpdateItem);
  const url = useBackendUrl();

  const flush = useCallback(async () => {
    if (!url) return;
    const state = useProgressStore.getState();
    if (state.updateQueue.length === 0) return;
    const user = useAuthStore.getState();
    await syncProgress(state.updateQueue, removeUpdateItem, url, user.account);
  }, [removeUpdateItem, url]);

  useEffect(() => {
    clearUpdateQueue();
  }, [clearUpdateQueue]);

  useEffect(() => {
    registerProgressSyncFlush(flush);
  }, [flush]);

  // Periodic sync while the app is open.
  useEffect(() => {
    const interval = setInterval(() => {
      void flush();
    }, SYNC_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [flush]);

  // Flush when the tab goes to background or the page unloads.
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

  // Deletes should reach the server promptly (user action).
  useEffect(() => {
    const originalRemoveItem = useProgressStore.getState().removeItem;
    useProgressStore.setState({
      removeItem: (...args) => {
        originalRemoveItem(...args);
        void flush();
      },
    });
  }, [flush]);

  return null;
}
