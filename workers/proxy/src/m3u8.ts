/// <reference types="@cloudflare/workers-types" />

import { corsHeaders, DEFAULT_UA } from "./headers";
import { assertPublicDestination } from "./ip";
import { buildOriginHeaders } from "./proxy";

function parseURL(reqUrl: string, baseUrl?: string): string | null {
  if (baseUrl) {
    try {
      return new URL(reqUrl, baseUrl).href;
    } catch {
      return null;
    }
  }

  let candidate = reqUrl;
  const match = candidate.match(
    /^(?:(https?:)?\/\/)?(([^/?]+?)(?::(\d{0,5})(?=[/?]|$))?)([/?][\S\s]*|$)/i,
  );

  if (!match) return null;

  if (!match[1]) {
    if (/^https?:/i.test(candidate)) return null;
    if (candidate.lastIndexOf("//", 0) === -1) {
      candidate = `//${candidate}`;
    }
    candidate = `${match[4] === "443" ? "https:" : "http:"}${candidate}`;
  }

  try {
    const parsed = new URL(candidate);
    if (!parsed.hostname) return null;
    return parsed.href;
  } catch {
    return null;
  }
}

function proxyUrl(
  baseProxyUrl: string,
  path: "m3u8-proxy" | "ts-proxy",
  target: string,
  headers: Record<string, string>,
  directSegments: boolean,
): string {
  const encodedHeaders = encodeURIComponent(JSON.stringify(headers));
  const directQuery = directSegments ? "&directSegments=1" : "";
  return `${baseProxyUrl}/${path}?url=${encodeURIComponent(target)}&headers=${encodedHeaders}${directQuery}`;
}

/**
 * Rewrite URI="..." / URI='...' / URI=... on HLS tag lines (MEDIA, KEY, MAP).
 * Relative paths must be resolved against the CDN playlist URL  otherwise
 * HLS.js resolves them against the proxy host (e.g. 127.0.0.1:8787/mc/...).
 */
function rewriteUriAttribute(
  line: string,
  sourceUrl: string,
  baseProxyUrl: string,
  headers: Record<string, string>,
  proxyPath: "m3u8-proxy" | "ts-proxy",
  directSegments: boolean,
): string {
  return line.replace(
    /URI=(?:"([^"]+)"|'([^']+)'|([^,\s]+))/gi,
    (
      full,
      d1: string | undefined,
      d2: string | undefined,
      d3: string | undefined,
    ) => {
      const raw = d1 ?? d2 ?? d3;
      if (!raw) return full;
      const resolved = parseURL(raw, sourceUrl);
      if (!resolved) return full;
      if (directSegments && proxyPath === "ts-proxy") {
        if (d1 !== undefined) return `URI="${resolved}"`;
        if (d2 !== undefined) return `URI='${resolved}'`;
        return `URI=${resolved}`;
      }
      const proxied = proxyUrl(
        baseProxyUrl,
        proxyPath,
        resolved,
        headers,
        directSegments,
      );
      if (d1 !== undefined) return `URI="${proxied}"`;
      if (d2 !== undefined) return `URI='${proxied}'`;
      return `URI=${proxied}`;
    },
  );
}

function rewritePlaylist(
  m3u8Content: string,
  sourceUrl: string,
  baseProxyUrl: string,
  headers: Record<string, string>,
  directSegments: boolean,
): string {
  const lines = m3u8Content.split("\n");
  const newLines: string[] = [];
  const isMaster = m3u8Content.includes("RESOLUTION=");

  for (const line of lines) {
    if (line.startsWith("#")) {
      if (line.startsWith("#EXT-X-KEY:") || line.startsWith("#EXT-X-MAP:")) {
        // Keys / init segments → ts-proxy (binary)
        newLines.push(
          rewriteUriAttribute(
            line,
            sourceUrl,
            baseProxyUrl,
            headers,
            "ts-proxy",
            directSegments,
          ),
        );
      } else if (
        line.startsWith("#EXT-X-MEDIA:") ||
        line.startsWith("#EXT-X-I-FRAME-STREAM-INF:")
      ) {
        // Alternate audio/subs / I-frame playlists → m3u8-proxy
        newLines.push(
          rewriteUriAttribute(
            line,
            sourceUrl,
            baseProxyUrl,
            headers,
            "m3u8-proxy",
            directSegments,
          ),
        );
      } else if (line.startsWith("#EXT-X-BITRATE:")) {
        // Febbox/shegu inserts this between #EXTINF and the segment URL  drop it
        // so HLS.js associates each URL with the preceding #EXTINF.
        continue;
      } else {
        newLines.push(line);
      }
    } else if (line.trim()) {
      const resolved = parseURL(line, sourceUrl);
      if (resolved) {
        const isNestedPlaylist = /\.m3u8(\?|#|$)/i.test(resolved);
        const proxyPath: "m3u8-proxy" | "ts-proxy" =
          isMaster || isNestedPlaylist ? "m3u8-proxy" : "ts-proxy";

        if (directSegments && !isMaster && !isNestedPlaylist) {
          // IP-locked CDNs (e.g. vix-content.net): browser fetches segments
          // directly; Cloudflare/ts-proxy gets 403.
          newLines.push(resolved);
        } else {
          newLines.push(
            proxyUrl(
              baseProxyUrl,
              proxyPath,
              resolved,
              headers,
              directSegments,
            ),
          );
        }
      } else {
        newLines.push(line);
      }
    } else {
      newLines.push(line);
    }
  }

  return newLines.join("\n");
}

export async function handleM3u8(
  request: Request,
  corsOrigin: string,
): Promise<Response> {
  const url = new URL(request.url);
  const targetUrl = url.searchParams.get("url");
  const headersParam = url.searchParams.get("headers");

  if (!targetUrl) {
    return new Response("URL parameter is required", {
      status: 400,
      headers: corsHeaders(corsOrigin),
    });
  }

  let headers: Record<string, string>;
  try {
    headers = buildOriginHeaders(headersParam);
  } catch (err) {
    return new Response(
      err instanceof Error ? err.message : "Invalid headers",
      { status: 400, headers: corsHeaders(corsOrigin) },
    );
  }

  try {
    assertPublicDestination(targetUrl);
  } catch (err) {
    return new Response(
      err instanceof Error ? err.message : "Invalid destination",
      { status: 400, headers: corsHeaders(corsOrigin) },
    );
  }

  try {
    const response = await fetch(targetUrl, {
      headers: {
        "User-Agent": DEFAULT_UA,
        ...headers,
      },
    });

    if (!response.ok) {
      throw new Error(
        `Failed to fetch M3U8: ${response.status} ${response.statusText}`,
      );
    }

    const m3u8Content = await response.text();
    if (!m3u8Content.includes("#EXTM3U")) {
      throw new Error(
        "Upstream returned empty or invalid M3U8 (missing #EXTM3U)",
      );
    }
    const baseProxyUrl = `${url.protocol}//${url.host}`;
    const directSegments = url.searchParams.get("directSegments") === "1";
    const rewritten = rewritePlaylist(
      m3u8Content,
      // Prefer final URL after redirects so relative paths resolve correctly
      response.url || targetUrl,
      baseProxyUrl,
      headers,
      directSegments,
    );

    const outHeaders = corsHeaders(corsOrigin);
    outHeaders.set("Content-Type", "application/vnd.apple.mpegurl");
    outHeaders.set("Cache-Control", "no-cache, no-store, must-revalidate");

    return new Response(rewritten, { status: 200, headers: outHeaders });
  } catch (err) {
    return new Response(
      err instanceof Error ? err.message : "Error proxying M3U8 file",
      { status: 500, headers: corsHeaders(corsOrigin) },
    );
  }
}
