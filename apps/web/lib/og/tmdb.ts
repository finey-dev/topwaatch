import {
  DEFAULT_DESCRIPTION,
  SITE_NAME,
} from "./constants";

type DecodedMedia = {
  id: string;
  type: "movie" | "tv";
};

/** Mirrors apps/web/src/backend/metadata/tmdb.ts decodeTMDBId */
export function decodeTMDBSlug(slug: string): DecodedMedia | null {
  const [prefix, type, id] = slug.split("-", 3);
  if (prefix !== "tmdb" || !id) return null;
  if (type === "movie") return { id, type: "movie" };
  if (type === "tv") return { id, type: "tv" };
  return null;
}

function isV4Token(apiKey: string): boolean {
  return apiKey.startsWith("eyJ");
}

export type OgMediaPayload = {
  title: string;
  description: string;
  image?: string;
  imageType: "image/png" | "image/jpeg";
  pageTitle: string;
  ogType: "video.movie" | "video.tv_show" | "video.other";
};

export async function fetchOgMediaPayload(
  decoded: DecodedMedia,
): Promise<OgMediaPayload | null> {
  const apiKey = process.env.VITE_TMDB_READ_API_KEY?.trim();
  if (!apiKey) return null;

  const headers: Record<string, string> = { accept: "application/json" };
  const params = new URLSearchParams({ language: "en-US" });
  if (isV4Token(apiKey)) {
    headers.Authorization = `Bearer ${apiKey}`;
  } else {
    params.set("api_key", apiKey);
  }

  const endpoint =
    decoded.type === "movie"
      ? `https://api.themoviedb.org/3/movie/${decoded.id}`
      : `https://api.themoviedb.org/3/tv/${decoded.id}`;

  const response = await fetch(`${endpoint}?${params}`, { headers });
  if (!response.ok) return null;

  const data = (await response.json()) as {
    title?: string;
    name?: string;
    overview?: string;
    poster_path?: string | null;
  };

  const rawTitle = data.title ?? data.name;
  if (!rawTitle) return null;

  const title = rawTitle.trim();
  const overview = (data.overview ?? "").trim();
  const poster = data.poster_path
    ? `https://image.tmdb.org/t/p/w780${data.poster_path.startsWith("/") ? data.poster_path : `/${data.poster_path}`}`
    : undefined;

  return {
    title,
    description: overview || DEFAULT_DESCRIPTION,
    image: poster,
    imageType: poster ? "image/jpeg" : "image/png",
    pageTitle: `${SITE_NAME} - ${title}`,
    ogType: decoded.type === "movie" ? "video.movie" : "video.tv_show",
  };
}
