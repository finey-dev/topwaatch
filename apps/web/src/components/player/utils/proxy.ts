import { getLoadbalancedM3U8ProxyUrl } from "@/backend/providers/fetchers";
import { playlistNeedsDirectSegments } from "@topwaatch/providers";
import { getM3U8ProxyUrls, getProxyUrls } from "@/utils/proxyUrls";

function mergeStreamHeaders(
  headers: Record<string, string> = {},
  preferredHeaders: Record<string, string> = {},
): Record<string, string> {
  return { ...preferredHeaders, ...headers };
}

/** Pull the real CDN URL out of a `/proxy?destination=` wrapper. */
function unwrapProxyDestination(url: string): string | null {
  try {
    const parsed = new URL(url);
    const dest = parsed.searchParams.get("destination");
    return dest || null;
  } catch {
    return null;
  }
}

function withHeadersQuery(url: string, headers: Record<string, string>): string {
  if (Object.keys(headers).length === 0 || url.includes("headers=")) {
    return url;
  }
  try {
    const parsed = new URL(url);
    parsed.searchParams.set("headers", JSON.stringify(headers));
    return parsed.toString();
  } catch {
    return `${url}&headers=${encodeURIComponent(JSON.stringify(headers))}`;
  }
}

/**
 * Febbox/shegu fMP4 and vixsrc TS are large and CDN-signed with CORS *.
 * Proxying every .m4s through ts-proxy exceeds Worker CPU; fetch direct in browser.
 */
function withDirectSegmentsQuery(url: string, directSegments: boolean): string {
  if (!directSegments || url.includes("directSegments=")) return url;
  try {
    const parsed = new URL(url);
    parsed.searchParams.set("directSegments", "1");
    return parsed.toString();
  } catch {
    const sep = url.includes("?") ? "&" : "?";
    return `${url}${sep}directSegments=1`;
  }
}

/**
 * Creates a proxied M3U8 URL for HLS streams using a random proxy from config
 */
export function createM3U8ProxyUrl(
  url: string,
  headers: Record<string, string> = {},
  opts?: { directSegments?: boolean },
): string {
  const directSegments =
    opts?.directSegments ?? playlistNeedsDirectSegments(url);

  // Never nest proxies  m3u8-proxy rejects loopback destinations (SSRF).
  if (url.includes("/m3u8-proxy?")) {
    return withDirectSegmentsQuery(
      withHeadersQuery(url, headers),
      directSegments,
    );
  }
  if (url.includes("destination=")) {
    const real = unwrapProxyDestination(url);
    if (real) {
      let baked: Record<string, string> = {};
      try {
        const raw = new URL(url).searchParams.get("headers");
        if (raw) baked = JSON.parse(raw) as Record<string, string>;
      } catch {
        // ignore
      }
      return createM3U8ProxyUrl(real, { ...baked, ...headers }, opts);
    }
  }

  const proxyBaseUrl = getLoadbalancedM3U8ProxyUrl();

  if (!proxyBaseUrl) {
    console.warn("No M3U8 proxy URLs available in configuration");
    return url;
  }

  const encodedUrl = encodeURIComponent(url);
  const encodedHeaders = encodeURIComponent(JSON.stringify(headers));
  const directQuery = directSegments ? "&directSegments=1" : "";
  return `${proxyBaseUrl}/m3u8-proxy?url=${encodedUrl}${
    Object.keys(headers).length > 0 ? `&headers=${encodedHeaders}` : ""
  }${directQuery}`;
}

/**
 * Creates a proxied MP4/file URL that carries stream headers for the Worker.
 * Replaces the old browser-extension prepareStream path.
 */
export function createMP4ProxyUrl(
  url: string,
  headers: Record<string, string> = {},
): string {
  if (isUrlAlreadyProxied(url)) {
    return withHeadersQuery(url, headers);
  }

  const proxyUrls = getProxyUrls();
  const proxyBase = proxyUrls[0] ?? getLoadbalancedM3U8ProxyUrl();
  if (!proxyBase) {
    console.warn("No proxy URLs available for MP4 proxy");
    return url;
  }

  // PROXY_URLS may already end with /proxy
  const base = proxyBase.replace(/\/$/, "");
  const proxyEndpoint = base.endsWith("/proxy") ? base : `${base}/proxy`;
  const headersQuery =
    Object.keys(headers).length > 0
      ? `&headers=${encodeURIComponent(JSON.stringify(headers))}`
      : "";

  return `${proxyEndpoint}?destination=${encodeURIComponent(url)}${headersQuery}`;
}

/**
 * Ensure a loadable source URL goes through the Worker (CORS + CDN headers).
 * Replaces the old browser-extension prepareStream / DNR path.
 */
export function ensureProxiedPlaybackUrl(
  url: string,
  type: "hls" | "file",
  headers?: Record<string, string>,
  preferredHeaders?: Record<string, string>,
): string {
  const merged = mergeStreamHeaders(headers, preferredHeaders);

  if (type === "hls") {
    // createM3U8ProxyUrl unwraps accidental `/proxy?destination=` wrappers
    // and refuses to nest m3u8-proxy (that caused SSRF 400 on 127.0.0.1).
    return createM3U8ProxyUrl(url, merged);
  }

  // Always proxy file/MP4 streams  even with empty headers  so CDN CORS
  // works without the extension.
  return createMP4ProxyUrl(url, merged);
}

/**
 * Checks if a URL is already using one of the configured proxy services
 */
export function isUrlAlreadyProxied(url: string): boolean {
  if (url.includes("/m3u8-proxy?url=") || url.includes("/ts-proxy?url=")) {
    return true;
  }

  if (url.includes("destination=")) {
    return true;
  }

  const proxyUrls = getM3U8ProxyUrls();
  return proxyUrls.some((proxyUrl) => url.startsWith(proxyUrl));
}
