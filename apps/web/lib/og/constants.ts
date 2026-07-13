export const SITE_NAME = "TopWaatch";

export const DEFAULT_DESCRIPTION =
  "TopWaatch. Watch movies and shows with bookmarks, progress, and history that follow you across every device.";

export const OG_IMAGE_PATH = "/embed-preview.png";
export const OG_IMAGE_VERSION = "3";
export const OG_IMAGE_WIDTH = 1200;
export const OG_IMAGE_HEIGHT = 630;

export function truncateDescription(text: string, max = 200): string {
  const trimmed = text.replace(/\s+/g, " ").trim();
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, max - 1).trimEnd()}…`;
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export function resolveSiteOrigin(request: Request): string {
  const fromEnv = process.env.VITE_APP_DOMAIN?.replace(/\/$/, "");
  if (fromEnv) return fromEnv;

  const host =
    request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  const proto =
    request.headers.get("x-forwarded-proto") ??
    (host?.includes("localhost") ? "http" : "https");
  if (host) return `${proto}://${host}`;
  return "https://topwaatch.mov";
}

export function toAbsoluteUrl(origin: string, pathOrUrl: string): string {
  if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl;
  const path = pathOrUrl.startsWith("/") ? pathOrUrl : `/${pathOrUrl}`;
  return `${origin}${path}`;
}

export function defaultOgImageUrl(origin: string): string {
  return toAbsoluteUrl(origin, `${OG_IMAGE_PATH}?v=${OG_IMAGE_VERSION}`);
}

export function tmdbPosterUrl(posterPath: string | null | undefined): string | undefined {
  if (!posterPath) return undefined;
  const normalized = posterPath.startsWith("/") ? posterPath : `/${posterPath}`;
  return `https://image.tmdb.org/t/p/w780${normalized}`;
}
