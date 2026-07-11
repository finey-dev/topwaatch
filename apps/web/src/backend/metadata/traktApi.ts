import { conf } from "@/setup/config";
import { SimpleCache } from "@/utils/cache";

import { get } from "./tmdb";
import { TMDBMovieData } from "./types/tmdb";
import type {
  CuratedMovieList,
  TraktListResponse,
  TraktNetworkResponse,
  TraktReleaseResponse,
} from "./types/trakt";
import { mapWithConcurrency } from "@/utils/mapWithConcurrency";

function getTraktBaseUrl(): string {
  const config = conf();
  const url =
    config.BACKEND_URLS.length > 0
      ? config.BACKEND_URLS[0]
      : config.BACKEND_URL;
  return (url ?? "").replace(/\/$/, "");
}

// Map provider names to their Trakt endpoints
export const PROVIDER_TO_TRAKT_MAP = {
  "8": "netflixmovies", // Netflix Movies
  "8tv": "netflixtv", // Netflix TV Shows
  "2": "applemovie", // Apple TV+ Movies
  "2tv": "appletv", // Apple TV+ (both)
  "10": "primemovies", // Prime Video Movies
  "10tv": "primetv", // Prime Video TV Shows
  "15": "hulumovies", // Hulu Movies
  "15tv": "hulutv", // Hulu TV Shows
  "337": "disneymovies", // Disney+ Movies
  "337tv": "disneytv", // Disney+ TV Shows
  "1899": "hbomovies", // Max Movies
  "1899tv": "hbotv", // Max TV Shows
  "531": "paramountmovies", // Paramount+ Movies
  "531tv": "paramounttv", // Paramount+ TV Shows
} as const;

// Map provider names to their image filenames
export const PROVIDER_TO_IMAGE_MAP: Record<string, string> = {
  Max: "max",
  "Prime Video": "prime",
  Netflix: "netflix",
  "Disney+": "disney",
  Hulu: "hulu",
  "Apple TV+": "appletv",
  "Paramount+": "paramount",
};

// Cache for Trakt API responses
interface TraktCacheKey {
  endpoint: string;
}

const traktCache = new SimpleCache<TraktCacheKey, any>();
traktCache.setCompare((a, b) => a.endpoint === b.endpoint);
traktCache.initialize();

function unwrapTrpcData<T>(body: unknown): T {
  const b = body as { result?: { data?: { json?: T } | T }; error?: unknown };
  if (b?.error) {
    const err = b.error as { message?: string; json?: { message?: string } };
    throw new Error(err.json?.message || err.message || "tRPC error");
  }
  const data = b?.result?.data;
  if (data && typeof data === "object" && data !== null && "json" in data) {
    return (data as { json: T }).json;
  }
  return data as T;
}

function trpcInput(value: unknown): string {
  // Server expects bare input (no `{ json: ... }` transformer wrapper).
  return encodeURIComponent(JSON.stringify(value));
}

async function fetchTrpcQuery<T>(
  procedure: string,
  input?: unknown,
): Promise<T> {
  const base = getTraktBaseUrl();
  if (!base) {
    throw new Error("Backend URL is not configured for Trakt/discover");
  }

  const url =
    input === undefined
      ? `${base}/trpc/${procedure}`
      : `${base}/trpc/${procedure}?input=${trpcInput(input)}`;

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch ${procedure}: ${response.statusText}`);
  }

  return unwrapTrpcData<T>(await response.json());
}

// Base function to fetch a discover list by slug via tRPC
async function fetchFromTrakt<T = TraktListResponse>(
  slug: string,
): Promise<T> {
  if (!conf().USE_TRAKT) {
    return null as T;
  }

  const cacheKey: TraktCacheKey = { endpoint: slug };
  const cachedResult = traktCache.get(cacheKey);
  if (cachedResult) {
    return cachedResult as T;
  }

  const result = await fetchTrpcQuery<T>("discover.list", { slug });
  traktCache.set(cacheKey, result, 3600);
  return result;
}

// Release details
export async function getReleaseDetails(
  id: string,
  season?: number,
  episode?: number,
): Promise<TraktReleaseResponse> {
  if (!conf().USE_TRAKT) {
    return null as unknown as TraktReleaseResponse;
  }

  const cacheKey: TraktCacheKey = {
    endpoint: `release:${id}:${season ?? ""}:${episode ?? ""}`,
  };
  const cachedResult = traktCache.get(cacheKey);
  if (cachedResult) {
    return cachedResult as TraktReleaseResponse;
  }

  const result = await fetchTrpcQuery<TraktReleaseResponse>("discover.release", {
    id,
    season,
    episode,
  });
  traktCache.set(cacheKey, result, 3600);
  return result;
}

// Latest releases
export const getLatestReleases = () => fetchFromTrakt("latest");
export const getLatest4KReleases = () => fetchFromTrakt("latest4k");
export const getLatestTVReleases = () => fetchFromTrakt("latesttv");

// Streaming service releases
export const getAppleTVReleases = () => fetchFromTrakt("appletv");
export const getAppleMovieReleases = () => fetchFromTrakt("applemovie");
export const getNetflixMovies = () => fetchFromTrakt("netflixmovies");
export const getNetflixTVShows = () => fetchFromTrakt("netflixtv");
export const getPrimeMovies = () => fetchFromTrakt("primemovies");
export const getPrimeTVShows = () => fetchFromTrakt("primetv");
export const getHuluMovies = () => fetchFromTrakt("hulumovies");
export const getHuluTVShows = () => fetchFromTrakt("hulutv");
export const getDisneyMovies = () => fetchFromTrakt("disneymovies");
export const getDisneyTVShows = () => fetchFromTrakt("disneytv");
export const getHBOMovies = () => fetchFromTrakt("hbomovies");
export const getHBOTVShows = () => fetchFromTrakt("hbotv");
export const getParamountMovies = () => fetchFromTrakt("paramountmovies");
export const getParamountTVShows = () => fetchFromTrakt("paramounttv");

// Popular content
export const getPopularTVShows = () => fetchFromTrakt("populartv");
export const getPopularMovies = () => fetchFromTrakt("popularmovies");
export const getTop10Movies = () => fetchFromTrakt("top10");

// Discovery content used for the featured carousel
export const getDiscoverContent = () =>
  fetchFromTrakt<TraktListResponse>("discover");

// Network information
export async function getNetworkContent(
  tmdbId: string,
): Promise<TraktNetworkResponse> {
  if (!conf().USE_TRAKT) {
    return null as unknown as TraktNetworkResponse;
  }

  const cacheKey: TraktCacheKey = { endpoint: `network:${tmdbId}` };
  const cachedResult = traktCache.get(cacheKey);
  if (cachedResult) {
    return cachedResult as TraktNetworkResponse;
  }

  const result = await fetchTrpcQuery<TraktNetworkResponse>("discover.network", {
    tmdbId,
  });
  traktCache.set(cacheKey, result, 3600);
  return result;
}

// Curated movie lists
export const getNarrativeMovies = () => fetchFromTrakt("narrative");
export const getTopMovies = () => fetchFromTrakt("top");
export const getNeverHeardMovies = () => fetchFromTrakt("never");
export const getLGBTQContent = () => fetchFromTrakt("LGBTQ");
export const getMindfuckMovies = () => fetchFromTrakt("mindfuck");
export const getTrueStoryMovies = () => fetchFromTrakt("truestory");
export const getChristmasMovies = () => fetchFromTrakt("christmas");
export const getHalloweenMovies = () => fetchFromTrakt("halloween");

// Get all curated movie lists
export const getCuratedMovieLists = async (): Promise<CuratedMovieList[]> => {
  const listConfigs = [
    {
      name: "Top Rated Christmas Movies",
      slug: "christmas",
    },
    {
      name: "Letterboxd Top 250 Narrative Feature Films",
      slug: "narrative",
    },
    {
      name: "1001 Greatest Movies of All Time",
      slug: "top",
    },
    {
      name: "Great Movies You May Have Never Heard Of",
      slug: "never",
    },
    {
      name: "LGBT Movies/Shows",
      slug: "LGBTQ",
    },
    {
      name: "Best Mindfuck Movies",
      slug: "mindfuck",
    },
    {
      name: "Based on a True Story Movies",
      slug: "truestory",
    },
    {
      name: "Halloween Movies",
      slug: "halloween",
    },
  ];

  const lists: CuratedMovieList[] = [];

  for (const config of listConfigs) {
    try {
      const response = await fetchFromTrakt(config.slug);
      lists.push({
        listName: config.name,
        listSlug: config.slug,
        tmdbIds: response.movie_tmdb_ids.slice(0, 30),
        count: Math.min(response.movie_tmdb_ids.length, 30),
      });
    } catch (error) {
      console.error(`Failed to fetch ${config.name}:`, error);
    }
  }

  return lists;
};

// Fetch movie details for multiple TMDB IDs (poster/title only  no heavy appends)
export const getMovieDetailsForIds = async (
  tmdbIds: number[],
  limit: number = 50,
): Promise<TMDBMovieData[]> => {
  const limitedIds = tmdbIds.slice(0, limit);
  const maxAttempts = 3;

  const fetchOne = async (id: number): Promise<TMDBMovieData | null> => {
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        return await get<TMDBMovieData>(`/movie/${id}`);
      } catch (error) {
        const status =
          typeof error === "object" &&
          error &&
          "statusCode" in error &&
          typeof (error as { statusCode?: unknown }).statusCode === "number"
            ? (error as { statusCode: number }).statusCode
            : typeof error === "object" &&
                error &&
                "status" in error &&
                typeof (error as { status?: unknown }).status === "number"
              ? (error as { status: number }).status
              : undefined;

        const retryable =
          status === 429 || status === 502 || status === 503 || status === 504;
        if (!retryable || attempt === maxAttempts) {
          console.error(`Failed to fetch movie details for ID ${id}:`, error);
          return null;
        }

        await new Promise((resolve) =>
          setTimeout(resolve, 250 * 2 ** (attempt - 1)),
        );
      }
    }
    return null;
  };

  const results = await mapWithConcurrency(limitedIds, 3, fetchOne, {
    delayBetweenBatchesMs: 120,
  });

  return results.filter((result): result is TMDBMovieData => result !== null);
};
