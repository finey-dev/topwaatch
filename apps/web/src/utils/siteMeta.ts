export const SITE_NAME = "TopWaatch";

export const DEFAULT_DESCRIPTION =
  "TopWaatch. Watch movies and shows with bookmarks, progress, and history that follow you across every device.";

/** Served from apps/web/public — bump when replacing the artwork. */
export const OG_IMAGE_PATH = "/embed-preview.png";
export const OG_IMAGE_VERSION = "3";
export const OG_IMAGE_WIDTH = 1200;
export const OG_IMAGE_HEIGHT = 630;

export function getSiteOrigin(): string {
  const fromEnv = import.meta.env.VITE_APP_DOMAIN?.replace(/\/$/, "");
  if (typeof window !== "undefined") {
    return fromEnv || window.location.origin;
  }
  return fromEnv || "https://topwaatch.mov";
}

export function toAbsoluteUrl(pathOrUrl: string): string {
  if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl;
  const origin = getSiteOrigin();
  const path = pathOrUrl.startsWith("/") ? pathOrUrl : `/${pathOrUrl}`;
  return `${origin}${path}`;
}

export function defaultOgImageUrl(): string {
  return toAbsoluteUrl(`${OG_IMAGE_PATH}?v=${OG_IMAGE_VERSION}`);
}

export function truncateDescription(text: string, max = 200): string {
  const trimmed = text.replace(/\s+/g, " ").trim();
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, max - 1).trimEnd()}…`;
}

export function isDefaultOgImage(image: string | null | undefined): boolean {
  if (!image) return true;
  if (image === OG_IMAGE_PATH) return true;
  return image.includes(OG_IMAGE_PATH);
}
