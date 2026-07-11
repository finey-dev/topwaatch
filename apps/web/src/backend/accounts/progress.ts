import { ProgressResponse } from "@/backend/accounts/user";
import { AccountWithToken } from "@/stores/auth";
import { ProgressMediaItem, ProgressUpdateItem } from "@/stores/progress";
import { trpcClient } from "@/utils/trpc";

export interface ProgressInput {
  meta?: {
    title: string;
    year: number;
    poster?: string;
    type: string;
  };
  tmdbId: string;
  watched: number;
  duration: number;
  seasonId?: string;
  episodeId?: string;
  seasonNumber?: number;
  episodeNumber?: number;
  updatedAt?: string;
}

export function progressUpdateItemToInput(
  item: ProgressUpdateItem,
): ProgressInput {
  return {
    duration: item.progress?.duration ?? 0,
    watched: item.progress?.watched ?? 0,
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

export function progressMediaItemToInputs(
  tmdbId: string,
  item: ProgressMediaItem,
): ProgressInput[] {
  if (item.type === "show") {
    return Object.entries(item.episodes).flatMap(([_, episode]) => ({
      duration: item.progress?.duration ?? episode.progress.duration,
      watched: item.progress?.watched ?? episode.progress.watched,
      tmdbId,
      meta: {
        title: item.title ?? "",
        type: item.type ?? "",
        year: item.year ?? NaN,
        poster: item.poster,
      },
      episodeId: episode.id,
      seasonId: episode.seasonId,
      episodeNumber: episode.number,
      seasonNumber: item.seasons[episode.seasonId].number,
      updatedAt: new Date(episode.updatedAt).toISOString(),
    }));
  }
  return [
    {
      duration: item.progress?.duration ?? 0,
      watched: item.progress?.watched ?? 0,
      tmdbId,
      updatedAt: new Date(item.updatedAt).toISOString(),
      meta: {
        title: item.title ?? "",
        type: item.type ?? "",
        year: item.year ?? NaN,
        poster: item.poster,
      },
    },
  ];
}

function toProgressData(input: ProgressInput) {
  const type = (input.meta?.type || "movie") as "movie" | "show" | "tv";
  return {
    meta: {
      title: input.meta?.title ?? "",
      year: Number.isFinite(input.meta?.year) ? input.meta?.year : undefined,
      poster: input.meta?.poster,
      type,
    },
    tmdbId: input.tmdbId,
    duration: input.duration,
    watched: input.watched,
    seasonId: input.seasonId,
    episodeId: input.episodeId,
    seasonNumber: input.seasonNumber,
    episodeNumber: input.episodeNumber,
    updatedAt: input.updatedAt,
  };
}

export async function setProgress(
  _url: string,
  _account: AccountWithToken,
  input: ProgressInput,
) {
  const result = await trpcClient.progress.upsert.mutate({
    tmdbId: input.tmdbId,
    data: toProgressData(input),
  });

  return {
    tmdbId: result.tmdbId,
    season: {
      id: result.seasonId ?? undefined,
      number: result.seasonNumber ?? undefined,
    },
    episode: {
      id: result.episodeId ?? undefined,
      number: result.episodeNumber ?? undefined,
    },
    meta: result.meta as ProgressResponse["meta"],
    duration: String(result.duration),
    watched: String(result.watched),
    updatedAt:
      typeof result.updatedAt === "string"
        ? result.updatedAt
        : new Date(result.updatedAt).toISOString(),
  } satisfies ProgressResponse;
}

export async function removeProgress(
  _url: string,
  _account: AccountWithToken,
  id: string,
  episodeId?: string,
  seasonId?: string,
) {
  await trpcClient.progress.delete.mutate({
    tmdbId: id,
    data: {
      episodeId,
      seasonId,
    },
  });
}
