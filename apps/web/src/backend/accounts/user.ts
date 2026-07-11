import { AccountWithToken } from "@/stores/auth";
import { BookmarkMediaItem } from "@/stores/bookmarks";
import { ProgressMediaItem } from "@/stores/progress";
import { WatchHistoryItem } from "@/stores/watchHistory";
import { trpcClient } from "@/utils/trpc";

export interface UserResponse {
  id: string;
  namespace: string;
  nickname: string;
  permissions: string[];
  image?: string | null;
  profile: {
    colorA: string;
    colorB: string;
    icon: string;
  };
}

export interface SessionResponse {
  id: string;
  userId: string;
  createdAt: string;
  accessedAt: string;
  device: string;
  userAgent: string;
}

export interface UserEdit {
  profile?: {
    colorA: string;
    colorB: string;
    icon: string;
  };
  nickname?: string;
}

export interface BookmarkResponse {
  tmdbId: string;
  meta: {
    title: string;
    year: number;
    poster?: string;
    type: "show" | "movie";
  };
  group: string[];
  favoriteEpisodes?: string[];
  updatedAt: string;
}

export interface ProgressResponse {
  tmdbId: string;
  season: {
    id?: string;
    number?: number;
  };
  episode: {
    id?: string;
    number?: number;
  };
  meta: {
    title: string;
    year: number;
    poster?: string;
    type: "show" | "movie";
  };
  duration: string;
  watched: string;
  updatedAt: string;
}

export interface WatchHistoryResponse {
  tmdbId: string;
  season: {
    id?: string;
    number?: number;
  };
  episode: {
    id?: string;
    number?: number;
  };
  meta: {
    title: string;
    year: number;
    poster?: string;
    type: "show" | "movie";
  };
  duration: string;
  watched: string;
  watchedAt: string;
  completed: boolean;
}

export function bookmarkResponsesToEntries(responses: BookmarkResponse[]) {
  const entries = responses.map((bookmark) => {
    const item: BookmarkMediaItem = {
      ...bookmark.meta,
      group: bookmark.group?.length > 0 ? bookmark.group : undefined,
      favoriteEpisodes: bookmark.favoriteEpisodes,
      updatedAt: new Date(bookmark.updatedAt).getTime(),
    };
    return [bookmark.tmdbId, item] as const;
  });

  return Object.fromEntries(entries);
}

export function progressResponsesToEntries(responses: ProgressResponse[]) {
  const items: Record<string, ProgressMediaItem> = {};

  responses.forEach((v) => {
    if (!items[v.tmdbId]) {
      items[v.tmdbId] = {
        title: v.meta.title,
        poster: v.meta.poster,
        type: v.meta.type,
        updatedAt: new Date(v.updatedAt).getTime(),
        episodes: {},
        seasons: {},
        year: v.meta.year,
      };
    }

    const item = items[v.tmdbId];

    if (new Date(v.updatedAt).getTime() > item.updatedAt) {
      item.updatedAt = new Date(v.updatedAt).getTime();
    }

    if (item.type === "movie") {
      item.progress = {
        duration: Number(v.duration),
        watched: Number(v.watched),
      };
    }

    if (item.type === "show" && v.season.id && v.episode.id) {
      item.seasons[v.season.id] = {
        id: v.season.id,
        number: v.season.number ?? 0,
        title: "",
      };
      item.episodes[v.episode.id] = {
        id: v.episode.id,
        number: v.episode.number ?? 0,
        title: "",
        progress: {
          duration: Number(v.duration),
          watched: Number(v.watched),
        },
        seasonId: v.season.id,
        updatedAt: new Date(v.updatedAt).getTime(),
      };
    }
  });

  return items;
}

export function watchHistoryResponsesToEntries(
  responses: WatchHistoryResponse[],
) {
  const items: Record<string, WatchHistoryItem> = {};

  responses.forEach((v) => {
    const key = v.episode?.id ? `${v.tmdbId}-${v.episode.id}` : v.tmdbId;

    items[key] = {
      type: v.meta.type,
      title: v.meta.title,
      poster: v.meta.poster,
      year: v.meta.year,
      progress: {
        duration: Number(v.duration),
        watched: Number(v.watched),
      },
      watchedAt: new Date(v.watchedAt).getTime(),
      completed: v.completed,
      episodeId: v.episode?.id,
      seasonId: v.season?.id,
      seasonNumber: v.season?.number,
      episodeNumber: v.episode?.number,
    };
  });

  return items;
}

function defaultProfile() {
  return {
    colorA: "#553DB6",
    colorB: "#9A78F0",
    icon: "user",
  };
}

export async function getUser(
  _url?: string,
  _token?: string,
): Promise<{ user: UserResponse; session: SessionResponse }> {
  const me = await trpcClient.me.get.query();
  const profile =
    (me.user.profile as UserResponse["profile"] | null) ?? defaultProfile();

  return {
    user: {
      id: me.user.id,
      namespace: me.user.email,
      nickname: me.user.nickname,
      permissions: [],
      image: me.user.image ?? null,
      profile,
    },
    session: {
      id: me.session.id,
      userId: me.session.userId,
      createdAt: new Date().toISOString(),
      accessedAt: new Date().toISOString(),
      device: "Web",
      userAgent: typeof navigator !== "undefined" ? navigator.userAgent : "",
    },
  };
}

export async function editUser(
  _url: string,
  _account: AccountWithToken,
  object: UserEdit,
): Promise<{ user: UserResponse; session: SessionResponse }> {
  const updated = await trpcClient.profile.update.mutate(object);
  const me = await getUser();
  return {
    user: {
      ...me.user,
      nickname: updated.nickname,
      profile: (updated.profile as UserResponse["profile"]) ?? me.user.profile,
    },
    session: me.session,
  };
}

export async function deleteUser(
  _url: string,
  _account: AccountWithToken,
  confirmEmail: string,
) {
  await trpcClient.profile.deleteAccount.mutate({ confirmEmail });
  return {
    id: _account.userId,
    namespace: "",
    nickname: "",
    permissions: [],
    profile: defaultProfile(),
  } satisfies UserResponse;
}

export async function deactivateUser() {
  await trpcClient.profile.deactivateAccount.mutate();
}

export async function getBookmarks(_url: string, _account: AccountWithToken) {
  const rows = await trpcClient.bookmarks.list.query();
  return rows.map((row) => ({
    tmdbId: row.tmdbId,
    meta: row.meta as BookmarkResponse["meta"],
    group: row.group ?? [],
    favoriteEpisodes: row.favoriteEpisodes ?? [],
    updatedAt:
      typeof row.updatedAt === "string"
        ? row.updatedAt
        : new Date(row.updatedAt).toISOString(),
  })) satisfies BookmarkResponse[];
}

export async function getProgress(_url: string, _account: AccountWithToken) {
  const rows = await trpcClient.progress.list.query();
  return rows.map((row) => ({
    tmdbId: row.tmdbId,
    season: {
      id: row.season?.id ?? undefined,
      number: row.season?.number ?? undefined,
    },
    episode: {
      id: row.episode?.id ?? undefined,
      number: row.episode?.number ?? undefined,
    },
    meta: row.meta as ProgressResponse["meta"],
    duration: row.duration,
    watched: row.watched,
    updatedAt: row.updatedAt,
  })) satisfies ProgressResponse[];
}

export async function getWatchHistory(
  _url: string,
  _account: AccountWithToken,
) {
  const rows = await trpcClient.watchHistory.list.query();
  return rows.map((row) => ({
    tmdbId: row.tmdbId,
    season: {
      id: row.season?.id,
      number: row.season?.number,
    },
    episode: {
      id: row.episode?.id,
      number: row.episode?.number,
    },
    meta: row.meta as WatchHistoryResponse["meta"],
    duration: row.duration,
    watched: row.watched,
    watchedAt: row.watchedAt,
    completed: row.completed,
  })) satisfies WatchHistoryResponse[];
}
