import { db } from "@topwaatch/db";
import { userSettings } from "@topwaatch/db/schema/user-settings";
import { env } from "@topwaatch/env/server";
import {
  makeProviders,
  makeSimpleProxyFetcher,
  makeStandardFetcher,
  setM3U8ProxyUrl,
  targets,
  type FullScraperEvents,
  type RunOutput,
  type ScrapeMedia,
  type Stream,
} from "@topwaatch/providers";
import { eq } from "drizzle-orm";
import { z } from "zod";

export const scrapeInputSchema = z.object({
  type: z.enum(["movie", "show"]),
  tmdbId: z.string().min(1),
  title: z.string().min(1),
  releaseYear: z.coerce.number().int(),
  seasonId: z.string().optional(),
  episodeId: z.string().optional(),
  seasonNumber: z.coerce.number().int().optional(),
  episodeNumber: z.coerce.number().int().optional(),
  seasonTitle: z.string().optional(),
  imdbId: z.string().optional(),
  sourceOrder: z.array(z.string()).optional(),
  embedOrder: z.array(z.string()).optional(),
  excludeSourceIds: z.array(z.string()).optional(),
  skipHevcFileStreams: z.coerce.boolean().optional(),
});

export type ScrapeInput = z.infer<typeof scrapeInputSchema>;

export type SourceAttempt = {
  id: string;
  status: "pending" | "success" | "failure" | "notfound";
  percentage?: number;
  reason?: string;
};

export type NotFoundPayload = {
  stream: null;
  error: string;
  tried: number;
  total: number;
  attempts: SourceAttempt[];
};

export type ScrapeSuccessResult = { ok: true } & RunOutput;
export type ScrapeNotFoundResult = { ok: false } & NotFoundPayload;
export type ScrapeResult = ScrapeSuccessResult | ScrapeNotFoundResult;

export function validateProxyUrl(url: string | undefined | null): string | null {
  if (!url?.trim()) return null;
  try {
    const parsed = new URL(url.trim());
    const isLocal =
      parsed.hostname === "localhost" ||
      parsed.hostname === "127.0.0.1" ||
      parsed.hostname === "[::1]";
    if (parsed.protocol === "https:") {
      // ok
    } else if (parsed.protocol === "http:" && isLocal) {
      // local wrangler / self-hosted proxy
    } else {
      return null;
    }
    return parsed.toString().replace(/\/$/, "");
  } catch {
    return null;
  }
}

export async function resolveProxyUrls(userId: string | null): Promise<{
  proxyUrl: string;
  m3u8Base: string;
}> {
  let custom: string | undefined;
  if (userId) {
    const settings = await db.query.userSettings.findFirst({
      where: eq(userSettings.id, userId),
    });
    custom = settings?.proxyUrls?.find((u) => validateProxyUrl(u));
  }

  const proxyUrl = validateProxyUrl(custom) ?? env.PROXY_DEFAULT_URL;

  let m3u8Base = env.M3U8_PROXY_DEFAULT_URL;
  try {
    const u = new URL(proxyUrl);
    if (u.pathname.replace(/\/$/, "") === "/proxy" || u.pathname.endsWith("/proxy")) {
      m3u8Base = u.origin;
    } else {
      m3u8Base = u.origin;
    }
  } catch {
    // keep default
  }

  return { proxyUrl, m3u8Base };
}

function toScrapeMedia(input: ScrapeInput): ScrapeMedia {
  if (input.type === "movie") {
    return {
      type: "movie",
      title: input.title,
      releaseYear: input.releaseYear,
      tmdbId: input.tmdbId,
      imdbId: input.imdbId,
    };
  }

  return {
    type: "show",
    title: input.title,
    releaseYear: input.releaseYear,
    tmdbId: input.tmdbId,
    imdbId: input.imdbId,
    season: {
      number: input.seasonNumber ?? 1,
      tmdbId: input.seasonId ?? input.tmdbId,
      title: input.seasonTitle ?? `Season ${input.seasonNumber ?? 1}`,
    },
    episode: {
      number: input.episodeNumber ?? 1,
      tmdbId: input.episodeId ?? input.tmdbId,
    },
  };
}

function collectStreamHeaders(stream: Stream): Record<string, string> {
  return {
    ...(stream.preferredHeaders ?? {}),
    ...(stream.headers ?? {}),
  };
}

function withProxyHeaders(
  url: string,
  headers: Record<string, string>,
): string {
  if (!url || Object.keys(headers).length === 0) return url;
  try {
    const parsed = new URL(url);
    if (parsed.searchParams.has("headers")) return url;
    parsed.searchParams.set("headers", JSON.stringify(headers));
    return parsed.toString();
  } catch {
    const sep = url.includes("?") ? "&" : "?";
    return `${url}${sep}headers=${encodeURIComponent(JSON.stringify(headers))}`;
  }
}

function rewriteUrlThroughProxy(
  url: string,
  proxyUrl: string,
  m3u8Base: string,
  headers: Record<string, string> = {},
  /** Force m3u8-proxy  HLS playlists often lack `.m3u8` in the path. */
  asHls = false,
): string {
  if (!url) return url;

  // Already proxied  still attach stream headers if missing (CDN Referer/Origin)
  if (
    url.includes("/m3u8-proxy?") ||
    url.includes("/ts-proxy?") ||
    url.includes("destination=")
  ) {
    return withProxyHeaders(url, headers);
  }

  const looksLikeHls =
    asHls ||
    url.includes(".m3u8") ||
    url.includes("application/vnd.apple.mpegurl") ||
    url.includes("/hls/");

  const headersQuery =
    Object.keys(headers).length > 0
      ? `&headers=${encodeURIComponent(JSON.stringify(headers))}`
      : "";

  if (looksLikeHls) {
    return `${m3u8Base.replace(/\/$/, "")}/m3u8-proxy?url=${encodeURIComponent(url)}${headersQuery}`;
  }

  return `${proxyUrl}?destination=${encodeURIComponent(url)}${headersQuery}`;
}

function rewriteStream(
  stream: Stream,
  proxyUrl: string,
  m3u8Base: string,
): Stream {
  const headers = collectStreamHeaders(stream);

  if (stream.type === "hls") {
    return {
      ...stream,
      // Always m3u8-proxy for playlists (rewrites segment URLs). Heuristic
      // URL matching misses hosts like imglink.info that omit `.m3u8`.
      playlist: rewriteUrlThroughProxy(
        stream.playlist,
        proxyUrl,
        m3u8Base,
        headers,
        true,
      ),
      captions: stream.captions?.map((cap) => ({
        ...cap,
        url: rewriteUrlThroughProxy(cap.url, proxyUrl, m3u8Base, headers),
      })),
    };
  }

  const qualities = { ...stream.qualities };
  for (const [key, val] of Object.entries(qualities)) {
    if (val?.url) {
      qualities[key as keyof typeof qualities] = {
        ...val,
        url: rewriteUrlThroughProxy(val.url, proxyUrl, m3u8Base, headers),
      };
    }
  }

  return {
    ...stream,
    qualities,
    captions: stream.captions?.map((cap) => ({
      ...cap,
      url: rewriteUrlThroughProxy(cap.url, proxyUrl, m3u8Base, headers),
    })),
  };
}

export function rewriteOutput(
  output: RunOutput,
  proxyUrl: string,
  m3u8Base: string,
): RunOutput {
  return {
    ...output,
    stream: rewriteStream(output.stream, proxyUrl, m3u8Base),
  };
}

function createProviders(proxyUrl: string, m3u8Base: string) {
  setM3U8ProxyUrl(m3u8Base);
  return makeProviders({
    fetcher: makeStandardFetcher(fetch),
    proxiedFetcher: makeSimpleProxyFetcher(proxyUrl, fetch),
    target: targets.NATIVE,
    consistentIpForRequests: true,
    externalSources: "all",
  });
}

/**
 * Runs providers.runAll  tries every source (and their embeds) in order until
 * one returns a playable stream. Only returns null after all sources fail.
 */
export async function runScrape(
  input: ScrapeInput,
  proxyUrl: string,
  m3u8Base: string,
  events?: FullScraperEvents,
): Promise<{
  output: RunOutput | null;
  attempts: SourceAttempt[];
  sourceIds: string[];
}> {
  const providers = createProviders(proxyUrl, m3u8Base);
  const media = toScrapeMedia(input);
  const attempts: SourceAttempt[] = [];
  let sourceIds: string[] = [];

  const output = await providers.runAll({
    media,
    sourceOrder: input.sourceOrder,
    embedOrder: input.embedOrder,
    excludeSourceIds: input.excludeSourceIds,
    skipHevcFileStreams: input.skipHevcFileStreams,
    events: {
      init: (evt) => {
        sourceIds = evt.sourceIds;
        for (const id of evt.sourceIds) {
          attempts.push({ id, status: "pending", percentage: 0 });
        }
        events?.init?.(evt);
      },
      start: (id) => {
        const row = attempts.find((a) => a.id === id);
        if (row) {
          row.status = "pending";
          row.percentage = 0;
        } else {
          attempts.push({ id, status: "pending", percentage: 0 });
        }
        events?.start?.(id);
      },
      update: (evt) => {
        const row = attempts.find((a) => a.id === evt.id);
        if (row) {
          row.status = evt.status;
          row.percentage = evt.percentage;
          row.reason = evt.reason;
        } else {
          attempts.push({
            id: evt.id,
            status: evt.status,
            percentage: evt.percentage,
            reason: evt.reason,
          });
        }
        events?.update?.(evt);
      },
      discoverEmbeds: (evt) => {
        events?.discoverEmbeds?.(evt);
      },
    },
  });

  return { output, attempts, sourceIds };
}

export function notFoundPayload(
  attempts: SourceAttempt[],
  sourceIds: string[],
): NotFoundPayload {
  const tried = attempts.filter((a) => a.status !== "pending").length;
  return {
    stream: null,
    error: "No stream found after trying all sources",
    tried,
    total: sourceIds.length || attempts.length,
    attempts,
  };
}

/**
 * Resolve proxy settings for a user and run a full scrape (all sources).
 */
export async function runScrapeForUser(
  input: ScrapeInput,
  userId: string | null,
  events?: FullScraperEvents,
): Promise<ScrapeResult> {
  const { proxyUrl, m3u8Base } = await resolveProxyUrls(userId);
  const { output, attempts, sourceIds } = await runScrape(
    input,
    proxyUrl,
    m3u8Base,
    events,
  );

  if (!output) {
    return { ok: false, ...notFoundPayload(attempts, sourceIds) };
  }

  return { ok: true, ...rewriteOutput(output, proxyUrl, m3u8Base) };
}
