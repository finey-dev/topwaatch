import { AccountWithToken } from "@/stores/auth";
import {
  WatchHistoryItem,
  WatchHistoryUpdateItem,
} from "@/stores/watchHistory";
import { trpcClient } from "@/utils/trpc";

export interface WatchHistoryInput {
  meta?: {
    title: string;
    year: number;
    poster?: string;
    type: string;
  };
  tmdbId: string;
  watched: number;
  duration: number;
  watchedAt: string;
  completed: boolean;
  seasonId?: string;
  episodeId?: string;
  seasonNumber?: number;
  episodeNumber?: number;
}

export interface WatchHistoryResponse {
  success: boolean;
}

export function watchHistoryUpdateItemToInput(
  item: WatchHistoryUpdateItem,
): WatchHistoryInput {
  return {
    duration: item.progress?.duration ?? 0,
    watched: item.progress?.watched ?? 0,
    watchedAt: item.watchedAt
      ? new Date(item.watchedAt).toISOString()
      : new Date().toISOString(),
    completed: item.completed ?? false,
    tmdbId: item.tmdbId,
    meta: {
      title: item.title ?? "",
      type: item.type ?? "",
      year: item.year ?? NaN,
      poster: item.poster,
    },
    episodeId: item.episodeId,
    seasonId: item.seasonId,
    episodeNumber: item.episodeNumber,
    seasonNumber: item.seasonNumber,
  };
}

export function watchHistoryItemToInputs(
  id: string,
  item: WatchHistoryItem,
): WatchHistoryInput {
  return {
    duration: item.progress.duration,
    watched: item.progress.watched,
    watchedAt: new Date(item.watchedAt).toISOString(),
    completed: item.completed,
    tmdbId: item.episodeId ? item.seasonId || id.split("-")[0] : id,
    meta: {
      title: item.title,
      type: item.type,
      year: item.year ?? NaN,
      poster: item.poster,
    },
    episodeId: item.episodeId,
    seasonId: item.seasonId,
    episodeNumber: item.episodeNumber,
    seasonNumber: item.seasonNumber,
  };
}

export function watchHistoryItemsToInputs(
  watchHistoryItems: Record<string, WatchHistoryItem>,
): WatchHistoryInput[] {
  return Object.entries(watchHistoryItems).map(([id, item]) =>
    watchHistoryItemToInputs(id, item),
  );
}

function toWatchHistoryData(input: WatchHistoryInput) {
  return {
    meta: {
      title: input.meta?.title ?? "",
      year: Number.isFinite(input.meta?.year) ? input.meta?.year : undefined,
      poster: input.meta?.poster,
      type: (input.meta?.type || "movie") as "movie" | "show",
    },
    tmdbId: input.tmdbId,
    duration: input.duration,
    watched: input.watched,
    watchedAt: input.watchedAt,
    completed: input.completed,
    seasonId: input.seasonId,
    episodeId: input.episodeId,
    seasonNumber: input.seasonNumber,
    episodeNumber: input.episodeNumber,
  };
}

export async function setWatchHistory(
  _url: string,
  _account: AccountWithToken,
  input: WatchHistoryInput,
) {
  await trpcClient.watchHistory.upsert.mutate({
    tmdbId: input.tmdbId,
    data: toWatchHistoryData(input),
  });
  return { success: true } satisfies WatchHistoryResponse;
}

export async function removeWatchHistory(
  _url: string,
  _account: AccountWithToken,
  id: string,
  episodeId?: string,
  seasonId?: string,
) {
  await trpcClient.watchHistory.delete.mutate({
    tmdbId: id,
    data: {
      episodeId,
      seasonId,
    },
  });
}
