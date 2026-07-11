import { BookmarkResponse } from "@/backend/accounts/user";
import { AccountWithToken } from "@/stores/auth";
import { BookmarkMediaItem } from "@/stores/bookmarks";
import { trpcClient } from "@/utils/trpc";

export interface BookmarkMetaInput {
  title: string;
  year: number;
  poster?: string;
  type: string;
}

export interface BookmarkInput {
  tmdbId: string;
  meta: BookmarkMetaInput;
  group?: string[];
  favoriteEpisodes?: string[];
}

export function bookmarkMediaToInput(
  tmdbId: string,
  item: BookmarkMediaItem,
): BookmarkInput {
  return {
    meta: {
      title: item.title,
      type: item.type,
      poster: item.poster,
      year: item.year ?? 0,
    },
    tmdbId,
    group: item.group,
    favoriteEpisodes: item.favoriteEpisodes,
  };
}

export async function addBookmark(
  _url: string,
  _account: AccountWithToken,
  input: BookmarkInput,
) {
  return trpcClient.bookmarks.upsert.mutate({
    tmdbId: input.tmdbId,
    meta: {
      title: input.meta.title,
      year: input.meta.year,
      poster: input.meta.poster,
      type: input.meta.type as "movie" | "show",
    },
    group: input.group,
    favoriteEpisodes: input.favoriteEpisodes,
  }) as Promise<BookmarkResponse>;
}

export async function removeBookmark(
  _url: string,
  _account: AccountWithToken,
  id: string,
) {
  return trpcClient.bookmarks.delete.mutate({ tmdbId: id });
}
