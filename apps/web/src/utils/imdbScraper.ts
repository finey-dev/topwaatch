/* eslint-disable no-console */
import { proxiedFetch } from "@/backend/helpers/fetch";
import { useAuthStore } from "@/stores/auth";
import { useLanguageStore } from "@/stores/language";
import { getProxyUrls } from "@/utils/proxyUrls";

import { getTmdbLanguageCode } from "./language";

// IMDb language code mapping (differs from TMDB format)
// Map from ISO language code to IMDb language parameter
const imdbLanguageMap: Record<string, string> = {
  "en-US": "en-US",
  "es-ES": "es-ES",
  "fr-FR": "fr-FR",
  "de-DE": "de-DE",
  "it-IT": "it-IT",
  "pt-PT": "pt-PT",
  "ru-RU": "ru-RU",
  "ja-JP": "ja-JP",
  "zh-CN": "zh-CN",
  "ko-KR": "ko-KR",
  "ar-SA": "ar-SA",
  "hi-IN": "hi-IN",
  "el-GR": "el-GR",
  // Add more mappings as needed
};

/**
 * Convert a TMDB-style language code to an IMDb language code
 * @param language TMDB-style language code (e.g., "en-US")
 * @returns IMDb language code or default "en-US"
 */
function getImdbLanguageCode(language: string): string {
  // If we have a direct mapping, use it
  if (imdbLanguageMap[language]) return imdbLanguageMap[language];

  // Otherwise default to English
  return "en-US";
}

interface IMDbMetadata {
  title?: string;
  original_title?: string;
  title_type?: string;
  year?: number | null;
  end_year?: number | null;
  day?: number | null;
  month?: number | null;
  date?: string;
  runtime?: number | null;
  age_rating?: string;
  imdb_rating?: number | null;
  votes?: number | null;
  plot?: string;
  poster_url?: string;
  trailer_url?: string;
  trailer_thumbnail?: string;
  url?: string;
  genre?: string[];
  cast?: string[];
  directors?: string[];
  writers?: string[];
  keywords?: string[];
  countries?: string[];
  languages?: string[];
  locations?: string[];
  season?: number;
  episode?: number;
  episode_title?: string;
  episode_plot?: string;
  episode_rating?: number;
  episode_votes?: number;
}

const months = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const userAgents = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:89.0) Gecko/20100101 Firefox/89.0",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.1 Safari/605.1.15",
];

function getRandomUserAgent(): string {
  return userAgents[Math.floor(Math.random() * userAgents.length)];
}

function extractNextData(html: string): unknown | null {
  // Prefer the classic Next.js payload. Also tolerate whitespace / attribute order.
  const classic = html.match(
    /<script[^>]*id=["']__NEXT_DATA__["'][^>]*>([\s\S]*?)<\/script>/i,
  );
  if (classic?.[1]) {
    try {
      return JSON.parse(classic[1]);
    } catch {
      /* continue */
    }
  }
  return null;
}

/**
 * Best-effort IMDb HTML scrape via the CORS media proxy.
 * IMDb often returns a WAF challenge (no `__NEXT_DATA__`) through that path 
 * callers should rely on TMDB for trailers when this returns empty.
 */
export async function scrapeIMDb(
  imdbId: string,
  season?: number,
  episode?: number,
  language?: string,
  _type?: "movie" | "show",
): Promise<IMDbMetadata> {
  const hasCustomProxy = Boolean(useAuthStore.getState().proxySet);
  const hasAnyProxy = hasCustomProxy || getProxyUrls().length > 0;

  if (!hasAnyProxy) {
    throw new Error(
      "IMDb scraping requires a CORS proxy. Configure one in Settings → Connections.",
    );
  }

  console.log("[IMDb Scraper] Using CORS proxy for requests");

  // Get user language if not provided
  if (!language) {
    const userLanguage = useLanguageStore.getState().language;
    language = getTmdbLanguageCode(userLanguage);
  }

  // Get IMDb language format
  const imdbLanguage = getImdbLanguageCode(language);

  // Construct IMDb URL with language parameter
  let imdbUrl = `https://www.imdb.com/title/${imdbId}/`;
  if (season && episode) {
    imdbUrl += `episodes?season=${season}`;
  }

  // Add language parameter to URL
  const separator = imdbUrl.includes("?") ? "&" : "?";
  imdbUrl += `${separator}locale=${imdbLanguage}`;

  // Add random delay to avoid rate limiting
  const delay = Math.floor(Math.random() * (197 - 69) + 69);
  await new Promise<void>((resolve) => {
    setTimeout(resolve, delay);
  });

  let response: string;
  try {
    response = await proxiedFetch<string>(imdbUrl, {
      headers: {
        "User-Agent": getRandomUserAgent(),
        "Accept-Language": imdbLanguage,
        Accept: "text/html,application/xhtml+xml",
      },
    });
  } catch (err) {
    console.warn("[IMDb Scraper] Proxy fetch failed:", err);
    return {};
  }

  if (typeof response !== "string" || response.length < 100) {
    console.warn(
      "[IMDb Scraper] Empty/short response (likely WAF challenge); skipping",
    );
    return {};
  }

  const data = extractNextData(response);
  if (!data) {
    console.warn(
      "[IMDb Scraper] No __NEXT_DATA__ on page (IMDb WAF blocks proxy scrapes); skipping",
    );
    return {};
  }

  const metadata: IMDbMetadata = {
    title: "",
    original_title: "",
    title_type: "",
    year: null,
    end_year: null,
    day: null,
    month: null,
    date: "",
    runtime: null,
    age_rating: "",
    imdb_rating: null,
    votes: null,
    plot: "",
    poster_url: "",
    trailer_url: "",
    url: imdbUrl,
    genre: [],
    cast: [],
    directors: [],
    writers: [],
    keywords: [],
    countries: [],
    languages: [],
    locations: [],
    season,
    episode,
  };

  try {
    // Extract all the metadata
    const pageProps = (data as any)?.props?.pageProps;
    const aboveTheFold = pageProps?.aboveTheFoldData;
    const mainColumn = pageProps?.mainColumnData;

    if (!aboveTheFold) {
      console.warn("[IMDb Scraper] Unexpected page payload shape; skipping");
      return {};
    }

    metadata.title = aboveTheFold.titleText?.text || "";
    metadata.original_title = aboveTheFold.originalTitleText?.text || "";
    metadata.title_type = aboveTheFold.titleType?.text || "";
    metadata.age_rating = aboveTheFold.certificate?.rating || "";
    metadata.year = aboveTheFold.releaseYear?.year || null;
    metadata.end_year = aboveTheFold.releaseYear?.endYear || null;
    metadata.day = aboveTheFold.releaseDate?.day || null;
    metadata.month = aboveTheFold.releaseDate?.month || null;

    if (metadata.month && metadata.day && metadata.year) {
      metadata.date = `${months[metadata.month - 1]} ${metadata.day}, ${metadata.year}`;
    }

    metadata.runtime = aboveTheFold.runtime?.seconds || null;
    metadata.plot = aboveTheFold.plot?.plotText?.plainText || "";
    metadata.imdb_rating = aboveTheFold.ratingsSummary?.aggregateRating || null;
    metadata.votes = aboveTheFold.ratingsSummary?.voteCount || null;
    metadata.poster_url = aboveTheFold.primaryImage?.url || "";
    const trailerNode = aboveTheFold.primaryVideos?.edges?.[0]?.node;
    metadata.trailer_url = trailerNode?.playbackURLs?.[0]?.url || "";
    metadata.trailer_thumbnail = trailerNode?.thumbnail?.url || "";

    // Extract arrays
    metadata.genre = aboveTheFold.genres?.genres?.map((g: any) => g.text) || [];
    metadata.cast =
      aboveTheFold.castPageTitle?.edges?.map(
        (e: any) => e.node.name.nameText.text,
      ) || [];
    metadata.directors =
      aboveTheFold.directorsPageTitle?.[0]?.credits?.map(
        (c: any) => c.name.nameText.text,
      ) || [];
    metadata.writers =
      mainColumn?.writers?.[0]?.credits?.map(
        (c: any) => c.name.nameText.text,
      ) || [];
    metadata.keywords =
      aboveTheFold.keywords?.edges?.map((e: any) => e.node.text) || [];
    metadata.countries =
      mainColumn?.countriesOfOrigin?.countries?.map((c: any) => c.text) || [];
    metadata.languages =
      mainColumn?.spokenLanguages?.spokenLanguages?.map((l: any) => l.text) ||
      [];
    metadata.locations =
      mainColumn?.filmingLocations?.edges?.map((e: any) => e.node.text) || [];

    // If season and episode are provided, get episode-specific data
    if (season && episode) {
      const episodeData = mainColumn?.episodes?.edges?.find(
        (e: any) => e.node.episodeNumber === episode,
      );

      if (episodeData) {
        metadata.episode_title = episodeData.node.titleText?.text || "";
        metadata.episode_plot =
          episodeData.node.plot?.plotText?.plainText || "";
        metadata.episode_rating =
          episodeData.node.ratingsSummary?.aggregateRating || null;
        metadata.episode_votes =
          episodeData.node.ratingsSummary?.voteCount || null;
      }
    }
  } catch (error) {
    console.warn("[IMDb Scraper] Error parsing IMDb data:", error);
    return {};
  }

  return metadata;
}
