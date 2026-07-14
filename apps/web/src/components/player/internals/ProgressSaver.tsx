import { useEffect, useRef, type MutableRefObject } from "react";
import { useInterval } from "react-use";

import { playerStatus } from "@/stores/player/slices/source";
import { usePlayerStore } from "@/stores/player/store";
import { ProgressItem, useProgressStore } from "@/stores/progress";
import { requestProgressSyncFlush } from "@/stores/progress/syncQueue";

/** Local save interval  updates zustand + coalesced queue only (no network). */
const LOCAL_SAVE_INTERVAL_MS = 10_000;

function progressIsNotStarted(duration: number, watched: number): boolean {
  if (watched < 20) return true;
  return false;
}

function progressIsCompleted(duration: number, watched: number): boolean {
  const timeFromEnd = duration - watched;
  if (timeFromEnd < 60 * 2) return true;
  return false;
}

function shouldSaveProgress(
  meta: any,
  progress: ProgressItem,
  existingItems: Record<string, any>,
): boolean {
  const { duration, watched } = progress;

  const isNotStarted = progressIsNotStarted(duration, watched);
  const isCompleted = progressIsCompleted(duration, watched);
  const isAcceptable = !isNotStarted && !isCompleted;

  if (meta.type === "movie") {
    return isAcceptable;
  }

  if (isAcceptable) return true;

  const showItem = existingItems[meta.tmdbId];
  if (!showItem || !meta.season) return false;

  const seasonEpisodes = Object.values(showItem.episodes).filter(
    (episode: any) => episode.seasonId === meta.season.tmdbId,
  );

  return seasonEpisodes.some((episode: any) => {
    const epProgress = episode.progress;
    return (
      !progressIsNotStarted(epProgress.duration, epProgress.watched) &&
      !progressIsCompleted(epProgress.duration, epProgress.watched)
    );
  });
}

function saveProgressSnapshot(
  meta: NonNullable<ReturnType<typeof usePlayerStore.getState>["meta"]>,
  progress: { time: number; duration: number },
  progressItems: Record<string, any>,
  updateItem: ReturnType<typeof useProgressStore.getState>["updateItem"],
  lastSavedRef: MutableRefObject<ProgressItem | null>,
) {
  const snapshot: ProgressItem = {
    duration: progress.duration,
    watched: progress.time,
  };

  let isDifferent = false;
  if (!lastSavedRef.current) isDifferent = true;
  else if (
    lastSavedRef.current.duration !== snapshot.duration ||
    lastSavedRef.current.watched !== snapshot.watched
  ) {
    isDifferent = true;
  }

  lastSavedRef.current = snapshot;

  if (isDifferent && shouldSaveProgress(meta, snapshot, progressItems)) {
    updateItem({ meta, progress: snapshot });
  }
}

export function ProgressSaver() {
  const meta = usePlayerStore((s) => s.meta);
  const progress = usePlayerStore((s) => s.progress);
  const updateItem = useProgressStore((s) => s.updateItem);
  const progressItems = useProgressStore((s) => s.items);
  const status = usePlayerStore((s) => s.status);
  const hasPlayedOnce = usePlayerStore((s) => s.mediaPlaying.hasPlayedOnce);

  const lastSavedRef = useRef<ProgressItem | null>(null);
  const prevStatusRef = useRef(status);

  const dataRef = useRef({
    updateItem,
    progressItems,
    meta,
    progress,
    status,
    hasPlayedOnce,
  });
  useEffect(() => {
    dataRef.current.updateItem = updateItem;
    dataRef.current.progressItems = progressItems;
    dataRef.current.meta = meta;
    dataRef.current.progress = progress;
    dataRef.current.status = status;
    dataRef.current.hasPlayedOnce = hasPlayedOnce;
  }, [updateItem, progressItems, progress, meta, status, hasPlayedOnce]);

  // Periodic local save while playing.
  useInterval(() => {
    const d = dataRef.current;
    if (!d.progress || !d.meta || !d.updateItem) return;
    if (d.status !== playerStatus.PLAYING) return;
    if (!d.hasPlayedOnce) return;

    saveProgressSnapshot(
      d.meta,
      d.progress,
      d.progressItems,
      d.updateItem,
      lastSavedRef,
    );
  }, LOCAL_SAVE_INTERVAL_MS);

  // Flush to server when playback stops (pause, navigate away, error, etc.).
  useEffect(() => {
    const d = dataRef.current;
    const wasPlaying = prevStatusRef.current === playerStatus.PLAYING;
    const isPlaying = status === playerStatus.PLAYING;

    if (wasPlaying && !isPlaying && d.meta && d.progress && d.hasPlayedOnce) {
      saveProgressSnapshot(
        d.meta,
        d.progress,
        d.progressItems,
        d.updateItem,
        lastSavedRef,
      );
      requestProgressSyncFlush();
    }

    prevStatusRef.current = status;
  }, [status, hasPlayedOnce, meta, progress, progressItems, updateItem]);

  return null;
}
