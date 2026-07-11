import { env } from "@topwaatch/env/server";

type CacheEntry = { data: unknown; expiresAt: number };

const cache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

export function getCached<T>(key: string): T | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    cache.delete(key);
    return null;
  }
  return entry.data as T;
}

export function setCache(key: string, data: unknown, ttl = CACHE_TTL_MS) {
  cache.set(key, { data, expiresAt: Date.now() + ttl });
}

export interface TraktListResponse {
  movie_tmdb_ids: number[];
  tv_tmdb_ids: number[];
  count: number;
}

export function emptyList(): TraktListResponse {
  return { movie_tmdb_ids: [], tv_tmdb_ids: [], count: 0 };
}

function traktHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "trakt-api-version": "2",
  };
  if (env.TRAKT_CLIENT_ID) {
    headers["trakt-api-key"] = env.TRAKT_CLIENT_ID;
  }
  return headers;
}

function tmdbHeaders(): Record<string, string> {
  const key = env.TMDB_READ_API_KEY ?? "";
  if (key.startsWith("eyJ")) {
    return {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    };
  }
  return { "Content-Type": "application/json" };
}

function tmdbUrl(path: string, params: Record<string, string> = {}): string {
  const url = new URL(`https://api.themoviedb.org/3${path}`);
  const key = env.TMDB_READ_API_KEY ?? "";
  if (key && !key.startsWith("eyJ")) {
    url.searchParams.set("api_key", key);
  }
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }
  return url.toString();
}

export async function tmdbGet<T>(
  path: string,
  params: Record<string, string> = {},
): Promise<T> {
  if (!env.TMDB_READ_API_KEY) {
    throw new Error("TMDB_READ_API_KEY is not configured");
  }
  const res = await fetch(tmdbUrl(path, params), { headers: tmdbHeaders() });
  if (!res.ok) {
    throw new Error(`TMDB ${path} failed: ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export async function traktGet<T>(path: string): Promise<T> {
  if (!env.TRAKT_CLIENT_ID) {
    throw new Error("TRAKT_CLIENT_ID is not configured");
  }
  const res = await fetch(`https://api.trakt.tv${path}`, {
    headers: traktHeaders(),
  });
  if (!res.ok) {
    throw new Error(`Trakt ${path} failed: ${res.status}`);
  }
  return res.json() as Promise<T>;
}

function extractTmdbIds(
  items: Array<{
    movie?: { ids?: { tmdb?: number } };
    show?: { ids?: { tmdb?: number } };
    ids?: { tmdb?: number };
  }>,
): TraktListResponse {
  const movie_tmdb_ids: number[] = [];
  const tv_tmdb_ids: number[] = [];

  for (const item of items) {
    if (item.movie?.ids?.tmdb) movie_tmdb_ids.push(item.movie.ids.tmdb);
    else if (item.show?.ids?.tmdb) tv_tmdb_ids.push(item.show.ids.tmdb);
    else if (item.ids?.tmdb) movie_tmdb_ids.push(item.ids.tmdb);
  }

  return {
    movie_tmdb_ids,
    tv_tmdb_ids,
    count: movie_tmdb_ids.length + tv_tmdb_ids.length,
  };
}

async function fromTraktMovies(path: string): Promise<TraktListResponse> {
  const data = await traktGet<
    Array<{ movie?: { ids?: { tmdb?: number } }; ids?: { tmdb?: number } }>
  >(path);
  return extractTmdbIds(data);
}

async function fromTraktShows(path: string): Promise<TraktListResponse> {
  const data = await traktGet<
    Array<{ show?: { ids?: { tmdb?: number } }; ids?: { tmdb?: number } }>
  >(path);
  const tv_tmdb_ids: number[] = [];
  for (const item of data) {
    const id = item.show?.ids?.tmdb ?? item.ids?.tmdb;
    if (id) tv_tmdb_ids.push(id);
  }
  return { movie_tmdb_ids: [], tv_tmdb_ids, count: tv_tmdb_ids.length };
}

async function fromTmdbWatchProvider(
  mediaType: "movie" | "tv",
  providerId: string,
): Promise<TraktListResponse> {
  const data = await tmdbGet<{ results: Array<{ id: number }> }>(
    `/discover/${mediaType}`,
    {
      with_watch_providers: providerId,
      watch_region: "US",
      sort_by: "popularity.desc",
      page: "1",
    },
  );
  const ids = data.results.map((r) => r.id);
  if (mediaType === "movie") {
    return { movie_tmdb_ids: ids, tv_tmdb_ids: [], count: ids.length };
  }
  return { movie_tmdb_ids: [], tv_tmdb_ids: ids, count: ids.length };
}

async function fromTraktListSearch(query: string): Promise<TraktListResponse> {
  try {
    const lists = await traktGet<
      Array<{ list?: { ids?: { trakt?: number } }; ids?: { trakt?: number } }>
    >(`/search/list?query=${encodeURIComponent(query)}&limit=1`);
    const listId = lists[0]?.list?.ids?.trakt ?? lists[0]?.ids?.trakt;
    if (!listId) return emptyList();

    const items = await traktGet<
      Array<{
        movie?: { ids?: { tmdb?: number } };
        show?: { ids?: { tmdb?: number } };
        type?: string;
      }>
    >(`/lists/${listId}/items/movie,show?limit=100`);
    return extractTmdbIds(items);
  } catch {
    return emptyList();
  }
}

export const LIST_HANDLERS: Record<string, () => Promise<TraktListResponse>> = {
  top10: () => fromTraktMovies("/movies/trending?limit=20"),
  top: () => fromTraktMovies("/movies/popular?limit=100"),
  popularmovies: () => fromTraktMovies("/movies/popular?limit=50"),
  populartv: () => fromTraktShows("/shows/popular?limit=50"),
  latest: () => fromTraktMovies("/movies/anticipated?limit=50"),
  latest4k: () => fromTraktMovies("/movies/boxoffice"),
  latesttv: () => fromTraktShows("/shows/anticipated?limit=50"),
  netflixmovies: () => fromTmdbWatchProvider("movie", "8"),
  netflixtv: () => fromTmdbWatchProvider("tv", "8"),
  primemovies: () => fromTmdbWatchProvider("movie", "9"),
  primetv: () => fromTmdbWatchProvider("tv", "9"),
  disneymovies: () => fromTmdbWatchProvider("movie", "337"),
  disneytv: () => fromTmdbWatchProvider("tv", "337"),
  hulumovies: () => fromTmdbWatchProvider("movie", "15"),
  hulutv: () => fromTmdbWatchProvider("tv", "15"),
  hbomovies: () => fromTmdbWatchProvider("movie", "1899"),
  hbotv: () => fromTmdbWatchProvider("tv", "1899"),
  applemovie: () => fromTmdbWatchProvider("movie", "350"),
  appletv: () => fromTmdbWatchProvider("tv", "350"),
  paramountmovies: () => fromTmdbWatchProvider("movie", "531"),
  paramounttv: () => fromTmdbWatchProvider("tv", "531"),
  christmas: () => fromTraktListSearch("christmas movies"),
  halloween: () => fromTraktListSearch("halloween movies"),
  narrative: () => fromTraktListSearch("letterboxd narrative"),
  never: () => fromTraktListSearch("never heard of"),
  LGBTQ: () => fromTraktListSearch("lgbt movies"),
  mindfuck: () => fromTraktListSearch("mindfuck"),
  truestory: () => fromTraktListSearch("true story"),
  discover: async () => {
    const [movies, shows] = await Promise.all([
      fromTraktMovies("/movies/trending?limit=30").catch(() => emptyList()),
      fromTraktShows("/shows/trending?limit=30").catch(() => emptyList()),
    ]);
    return {
      movie_tmdb_ids: movies.movie_tmdb_ids,
      tv_tmdb_ids: shows.tv_tmdb_ids,
      count: movies.movie_tmdb_ids.length + shows.tv_tmdb_ids.length,
    };
  },
};

export const DISCOVER_LIST_SLUGS = Object.keys(LIST_HANDLERS) as [
  string,
  ...string[],
];

export async function fetchDiscoverList(slug: string): Promise<TraktListResponse> {
  const handler = LIST_HANDLERS[slug];
  if (!handler) {
    throw new Error(`Unknown discover list slug: ${slug}`);
  }

  const cacheKey = `discover:list:${slug}`;
  const cached = getCached<TraktListResponse>(cacheKey);
  if (cached) return cached;

  const data = await handler();
  setCache(cacheKey, data);
  return data;
}

export async function buildDiscoverAggregate() {
  const [
    popularMovies,
    popularShows,
    movieGenres,
    tvGenres,
    topRatedMovies,
    topRatedShows,
    nowPlayingMovies,
    onTheAir,
    trending,
    mostWatched,
    lastWeekend,
  ] = await Promise.all([
    tmdbGet<{ results: unknown[] }>("/movie/popular"),
    tmdbGet<{ results: unknown[] }>("/tv/popular"),
    tmdbGet("/genre/movie/list"),
    tmdbGet("/genre/tv/list"),
    tmdbGet("/movie/top_rated"),
    tmdbGet("/tv/top_rated"),
    tmdbGet<{ results: Array<{ vote_average: number }> }>("/movie/now_playing"),
    tmdbGet<{ results: Array<{ vote_average: number }> }>("/tv/on_the_air"),
    env.TRAKT_CLIENT_ID
      ? traktGet("/movies/popular?limit=20").catch(() => [])
      : Promise.resolve([]),
    env.TRAKT_CLIENT_ID
      ? traktGet("/movies/watched/weekly?limit=20").catch(() => [])
      : Promise.resolve([]),
    env.TRAKT_CLIENT_ID
      ? traktGet("/movies/boxoffice").catch(() => [])
      : Promise.resolve([]),
  ]);

  const sortByVote = <T extends { vote_average: number }>(arr: T[]) =>
    [...arr].sort((a, b) => b.vote_average - a.vote_average);

  return {
    mostWatched,
    lastWeekend,
    trending,
    popular: {
      movies: sortByVote(
        (popularMovies.results as Array<{ vote_average: number }>) ?? [],
      ),
      shows: sortByVote(
        (popularShows.results as Array<{ vote_average: number }>) ?? [],
      ),
    },
    topRated: { movies: topRatedMovies, shows: topRatedShows },
    nowPlaying: {
      movies: sortByVote(nowPlayingMovies.results ?? []),
      shows: sortByVote(onTheAir.results ?? []),
    },
    genres: { movies: movieGenres, shows: tvGenres },
    traktLists: [] as unknown[],
  };
}

export async function fetchDiscoverAggregate() {
  const cached = getCached<unknown>("discover:aggregate");
  if (cached) return cached;

  const data = await buildDiscoverAggregate();
  setCache("discover:aggregate", data);
  return data;
}

export async function fetchReleaseDetails(
  id: string,
  season?: number,
  episode?: number,
) {
  const cacheKey = `discover:release:${id}:${season ?? ""}:${episode ?? ""}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  if (!env.TRAKT_CLIENT_ID) {
    return { tmdb_id: Number(id), title: "", type: "movie" };
  }

  const results = await traktGet<
    Array<{
      type: string;
      movie?: { title: string; year?: number; ids: { tmdb?: number } };
      show?: { title: string; year?: number; ids: { tmdb?: number } };
      episode?: { season: number; number: number };
    }>
  >(`/search/tmdb/${id}?type=movie,show`);

  const hit = results[0];
  const payload = {
    tmdb_id: Number(id),
    title: hit?.movie?.title ?? hit?.show?.title ?? "",
    year: hit?.movie?.year ?? hit?.show?.year,
    type:
      season !== undefined && episode !== undefined
        ? "episode"
        : hit?.type === "show"
          ? "episode"
          : "movie",
    season: season !== undefined ? season : undefined,
    episode: episode !== undefined ? episode : undefined,
  };

  setCache(cacheKey, payload);
  return payload;
}

export async function fetchNetworkProviders(tmdbId: string) {
  const cacheKey = `discover:network:${tmdbId}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  let providers: {
    results?: { US?: { flatrate?: Array<{ provider_name: string }> } };
  } | null = null;
  let type = "movie";
  try {
    providers = await tmdbGet(`/movie/${tmdbId}/watch/providers`);
  } catch {
    providers = await tmdbGet(`/tv/${tmdbId}/watch/providers`);
    type = "tv";
  }

  const platforms =
    providers?.results?.US?.flatrate?.map((p) => p.provider_name) ?? [];
  const payload = { type, platforms, count: platforms.length };
  setCache(cacheKey, payload);
  return payload;
}
