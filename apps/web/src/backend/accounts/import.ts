import { AccountWithToken } from "@/stores/auth";
import { trpcClient } from "@/utils/trpc";

import { BookmarkInput } from "./bookmarks";
import { ProgressInput } from "./progress";
import { SettingsInput, updateSettings } from "./settings";
import { WatchHistoryInput } from "./watchHistory";

export async function importProgress(
  _url: string,
  _account: AccountWithToken,
  progressItems: ProgressInput[],
) {
  if (progressItems.length === 0) return;
  await trpcClient.progress.importMany.mutate(
    progressItems.map((item) => ({
      tmdbId: item.tmdbId,
      duration: item.duration,
      watched: item.watched,
      seasonId: item.seasonId,
      episodeId: item.episodeId,
      seasonNumber: item.seasonNumber,
      episodeNumber: item.episodeNumber,
      updatedAt: item.updatedAt,
      meta: {
        title: item.meta?.title ?? "",
        type: (item.meta?.type === "show" ? "show" : "movie") as
          | "movie"
          | "show",
        year: Number.isFinite(item.meta?.year) ? item.meta?.year : undefined,
        poster: item.meta?.poster,
      },
    })),
  );
}

export async function importBookmarks(
  _url: string,
  _account: AccountWithToken,
  bookmarks: BookmarkInput[],
) {
  if (bookmarks.length === 0) return;
  await trpcClient.bookmarks.upsertMany.mutate(
    bookmarks.map((item) => ({
      tmdbId: item.tmdbId,
      meta: {
        title: item.meta.title,
        year: item.meta.year,
        poster: item.meta.poster,
        type: item.meta.type as "movie" | "show",
      },
      group: item.group,
      favoriteEpisodes: item.favoriteEpisodes,
    })),
  );
}

export async function importGroupOrder(
  _url: string,
  _account: AccountWithToken,
  groupOrder: string[],
) {
  await trpcClient.groupOrder.update.mutate(groupOrder);
}

export async function importWatchHistory(
  _url: string,
  _account: AccountWithToken,
  watchHistoryItems: WatchHistoryInput[],
) {
  if (watchHistoryItems.length === 0) return;
  // Upsert one-by-one / batched by tmdbId  API accepts array per tmdbId
  const byTmdb = new Map<string, WatchHistoryInput[]>();
  for (const item of watchHistoryItems) {
    const list = byTmdb.get(item.tmdbId) ?? [];
    list.push(item);
    byTmdb.set(item.tmdbId, list);
  }

  await Promise.all(
    [...byTmdb.entries()].map(([tmdbId, items]) =>
      trpcClient.watchHistory.upsert.mutate({
        tmdbId,
        data: items.map((item) => ({
          meta: {
            title: item.meta?.title ?? "",
            year: Number.isFinite(item.meta?.year) ? item.meta?.year : undefined,
            poster: item.meta?.poster,
            type: (item.meta?.type === "show" ? "show" : "movie") as
              | "movie"
              | "show",
          },
          tmdbId: item.tmdbId,
          duration: item.duration,
          watched: item.watched,
          watchedAt: item.watchedAt,
          completed: item.completed,
          seasonId: item.seasonId,
          episodeId: item.episodeId,
          seasonNumber: item.seasonNumber,
          episodeNumber: item.episodeNumber,
        })),
      }),
    ),
  );
}

export async function importSettings(
  _url: string,
  _account: AccountWithToken,
  settings: SettingsInput,
) {
  await updateSettings(_url, _account, settings);
}
