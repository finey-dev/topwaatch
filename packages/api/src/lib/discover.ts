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

async function fromTmdbPath(
  mediaType: "movie" | "tv",
  path: string,
  params: Record<string, string> = {},
): Promise<TraktListResponse> {
  const data = await tmdbGet<{ results: Array<{ id: number }> }>(path, params);
  const ids = data.results.map((r) => r.id);
  if (mediaType === "movie") {
    return { movie_tmdb_ids: ids, tv_tmdb_ids: [], count: ids.length };
  }
  return { movie_tmdb_ids: [], tv_tmdb_ids: ids, count: ids.length };
}

async function fromTmdbWatchProvider(
  mediaType: "movie" | "tv",
  providerId: string,
): Promise<TraktListResponse> {
  return fromTmdbPath(mediaType, `/discover/${mediaType}`, {
    with_watch_providers: providerId,
    watch_region: "US",
    sort_by: "popularity.desc",
    page: "1",
  });
}

/** Curated/theme lists via TMDB keyword search + discover (no Trakt required). */
async function fromTmdbKeywordSearch(query: string): Promise<TraktListResponse> {
  try {
    const keywords = await tmdbGet<{ results: Array<{ id: number }> }>(
      "/search/keyword",
      { query, page: "1" },
    );
    const keywordId = keywords.results[0]?.id;
    if (!keywordId) return emptyList();

    return fromTmdbPath("movie", "/discover/movie", {
      with_keywords: String(keywordId),
      sort_by: "popularity.desc",
      page: "1",
    });
  } catch {
    return emptyList();
  }
}

/**
 * Prefer TMDB for discover carousels. Trakt is optional enrichment only —
 * Vercel/datacenter IPs often get Trakt 403 even with a valid client id.
 */
export const LIST_HANDLERS: Record<string, () => Promise<TraktListResponse>> = {
  top10: () => fromTmdbPath("movie", "/trending/movie/week"),
  top: () => fromTmdbPath("movie", "/movie/popular"),
  popularmovies: () => fromTmdbPath("movie", "/movie/popular"),
  populartv: () => fromTmdbPath("tv", "/tv/popular"),
  latest: () => fromTmdbPath("movie", "/movie/upcoming"),
  latest4k: () => fromTmdbPath("movie", "/movie/now_playing"),
  latesttv: () => fromTmdbPath("tv", "/tv/on_the_air"),
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
  christmas: () => fromTmdbKeywordSearch("christmas"),
  halloween: () => fromTmdbKeywordSearch("halloween"),
  narrative: () => fromTmdbKeywordSearch("based on novel or book"),
  never: () => fromTmdbPath("movie", "/movie/top_rated", { page: "5" }),
  LGBTQ: () => fromTmdbKeywordSearch("lgbt"),
  mindfuck: () => fromTmdbKeywordSearch("mind-bending"),
  truestory: () => fromTmdbKeywordSearch("based on true story"),
  discover: async () => {
    const [movies, shows] = await Promise.all([
      fromTmdbPath("movie", "/trending/movie/week").catch(() => emptyList()),
      fromTmdbPath("tv", "/trending/tv/week").catch(() => emptyList()),
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
    trendingMovies,
  ] = await Promise.all([
    tmdbGet<{ results: unknown[] }>("/movie/popular"),
    tmdbGet<{ results: unknown[] }>("/tv/popular"),
    tmdbGet("/genre/movie/list"),
    tmdbGet("/genre/tv/list"),
    tmdbGet("/movie/top_rated"),
    tmdbGet("/tv/top_rated"),
    tmdbGet<{ results: Array<{ vote_average: number }> }>("/movie/now_playing"),
    tmdbGet<{ results: Array<{ vote_average: number }> }>("/tv/on_the_air"),
    tmdbGet<{ results: unknown[] }>("/trending/movie/week"),
  ]);

  const sortByVote = <T extends { vote_average: number }>(arr: T[]) =>
    [...arr].sort((a, b) => b.vote_average - a.vote_average);

  return {
    mostWatched: trendingMovies.results ?? [],
    lastWeekend: nowPlayingMovies.results ?? [],
    trending: trendingMovies.results ?? [],
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

  type TmdbTitle = { title?: string; name?: string; release_date?: string; first_air_date?: string };
  let hit: TmdbTitle | null = null;
  let mediaType: "movie" | "tv" = "movie";

  try {
    hit = await tmdbGet<TmdbTitle>(`/movie/${id}`);
    mediaType = "movie";
  } catch {
    try {
      hit = await tmdbGet<TmdbTitle>(`/tv/${id}`);
      mediaType = "tv";
    } catch {
      hit = null;
    }
  }

  const yearStr =
    hit?.release_date?.slice(0, 4) ?? hit?.first_air_date?.slice(0, 4);
  const payload = {
    tmdb_id: Number(id),
    title: hit?.title ?? hit?.name ?? "",
    year: yearStr ? Number(yearStr) : undefined,
    type:
      season !== undefined && episode !== undefined
        ? "episode"
        : mediaType === "tv"
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
