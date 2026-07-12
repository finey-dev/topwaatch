/**
 * End-to-end Showbox → Febbox resolve pipeline for TopWaatch 4K.
 */
import { createHash } from "node:crypto";

import { env } from "@topwaatch/env/server";

import { febboxMetaCache, febboxStreamCache } from "./cache";
import {
  getQualityLinks,
  getStreamsForMedia,
  hlsUrlForOssFid,
  isHlsPlayable,
  type FebboxFile,
} from "./client";
import {
  getFebboxShareKey,
  getShowboxSubtitles,
  searchShowbox,
} from "./showbox";

export type StreamEntry = { type: "hls" | "mp4"; url: string };

export type FileVariant = {
  fid: string;
  name: string;
  quality?: string;
  codec?: string;
  size?: string;
  tag?: "bw" | "dv" | "hdr" | "remux";
};

export type StreamData = {
  streams: Record<string, StreamEntry | string>;
  subtitles: Record<string, { subtitle_link: string; subtitle_name?: string }>;
  error?: string;
  name?: string;
  size?: string;
  shareKey?: string;
  variants?: FileVariant[];
  primaryFid?: string;
  ossFid?: string;
  /** Showbox media id  used to re-fetch captions on variant switch */
  showboxId?: string;
  mediaType?: "movie" | "show";
  season?: number;
  episode?: number;
};

export type ResolveMediaInput = {
  ui: string;
  title: string;
  year?: number;
  type: "movie" | "show";
  season?: number;
  episode?: number;
  /** Prefer HLS (artemis) vs MP4 qualities (aurora/fedapi) */
  preferHls?: boolean;
};

function detectTag(name: string): FileVariant["tag"] | undefined {
  const n = name.toLowerCase();
  if (/\b(bw|b&w|black\s*and\s*white)\b/.test(n)) return "bw";
  if (/\b(dv|dolby\s*vision)\b/.test(n)) return "dv";
  if (/\bhdr10?\+?\b/.test(n)) return "hdr";
  if (/\bremux\b/.test(n)) return "remux";
  return undefined;
}

function detectQuality(name: string): string | undefined {
  const m = name.match(/\b(2160p|1080p|720p|480p|360p|4k|uhd)\b/i);
  if (!m?.[1]) return undefined;
  const q = m[1].toLowerCase();
  if (q === "4k" || q === "uhd" || q === "2160p") return "4K";
  return q.toUpperCase().replace("P", "P");
}

function detectCodec(name: string): string | undefined {
  const n = name.toLowerCase();
  if (/\b(hevc|h\.?265|x265)\b/.test(n)) return "HEVC";
  if (/\b(avc|h\.?264|x264)\b/.test(n)) return "AVC";
  if (/\bav1\b/.test(n)) return "AV1";
  return undefined;
}

function toVariant(file: FebboxFile): FileVariant {
  return {
    fid: String(file.fid),
    name: file.file_name,
    quality: detectQuality(file.file_name),
    codec: detectCodec(file.file_name),
    size: file.size != null ? String(file.size) : undefined,
    tag: detectTag(file.file_name),
  };
}

function streamEntryIsHls(entry: StreamEntry | string): boolean {
  const url = typeof entry === 'string' ? entry : entry.url;
  const type = typeof entry === 'string' ? undefined : entry.type;
  return type === 'hls' || /\.m3u8(\?|#|$)/i.test(url) || /\/hls\//i.test(url);
}

function streamsHaveHls(streams: Record<string, StreamEntry | string>): boolean {
  return Object.values(streams).some(streamEntryIsHls);
}

async function appendHlsFallback(
  streams: Record<string, StreamEntry | string>,
  ossFid: number | string,
  ui: string,
  shareKey: string,
): Promise<void> {
  if (streamsHaveHls(streams)) return;
  const hlsOk = await isHlsPlayable(ossFid, ui, shareKey);
  if (hlsOk) {
    streams.HLS = {
      type: "hls",
      url: hlsUrlForOssFid(ossFid),
    };
  }
}

function qualityLabelToKey(quality: string): string | null {
  const q = quality.replace(/\s+/g, "").toUpperCase();
  if (q === "ORG" || q === "ORIGINAL") return "ORG";
  if (q === "4K" || q === "2160P" || q === "UHD") return "4K";
  if (q.endsWith("P")) return q;
  const n = parseInt(q, 10);
  if (!Number.isNaN(n)) return `${n}P`;
  return null;
}

function uiFingerprint(ui: string): string {
  return createHash("sha256").update(ui).digest("hex").slice(0, 16);
}

function resolveCacheKey(input: ResolveMediaInput): string {
  const { title, year, type, season, episode, preferHls, ui } = input;
  return [
    "resolve",
    uiFingerprint(ui),
    type,
    title.toLowerCase().trim(),
    year ?? "",
    season ?? "",
    episode ?? "",
    preferHls ? "hls" : "file",
  ].join(":");
}

export async function resolveMediaStreams(
  input: ResolveMediaInput,
): Promise<StreamData> {
  const cacheKey = resolveCacheKey(input);
  const cached = febboxStreamCache.get(cacheKey) as StreamData | undefined;
  if (cached) return cached;

  const data = await resolveMediaStreamsUncached(input);
  // Only cache successful resolves  signed URLs are short-lived anyway.
  if (!data.error && Object.keys(data.streams).length > 0) {
    febboxStreamCache.set(cacheKey, data);
  }
  return data;
}

async function resolveMediaStreamsUncached(
  input: ResolveMediaInput,
): Promise<StreamData> {
  const { ui, title, year, type, season, episode, preferHls } = input;

  const entry = await searchShowbox(title, year, type);
  if (!entry) {
    return { streams: {}, subtitles: {}, error: "Title not found in database" };
  }

  const shareKey = await getFebboxShareKey(entry.id, type);
  if (!shareKey) {
    return { streams: {}, subtitles: {}, error: "Share link not found in database" };
  }

  const files = await getStreamsForMedia(shareKey, ui, type, season, episode);
  if (files.length === 0) {
    return {
      streams: {},
      subtitles: {},
      error: "No stream found in database",
      shareKey,
    };
  }

  const variants = files.map(toVariant);
  // Prefer higher-res / remux-looking names first
  const ranked = [...files].sort((a, b) => {
    const score = (f: FebboxFile) => {
      let s = 0;
      const n = f.file_name.toLowerCase();
      if (/2160|4k|uhd/.test(n)) s += 400;
      else if (/1080/.test(n)) s += 300;
      else if (/720/.test(n)) s += 200;
      if (/remux/.test(n)) s += 50;
      if (/dv|dolby/.test(n)) s += 20;
      if (/\bbw\b|black/.test(n)) s -= 10;
      return s;
    };
    return score(b) - score(a);
  });

  const primary = ranked[0];
  if (!primary) {
    return {
      streams: {},
      subtitles: {},
      error: "No stream found in database",
      shareKey,
    };
  }

  const streams: Record<string, StreamEntry | string> = {};

  // Quality links first  often already HLS playlists; skip master probe when present.
  try {
    const links = await getQualityLinks(shareKey, primary.fid, ui);
    for (const link of links) {
      const key = qualityLabelToKey(link.quality);
      if (!link.url) continue;
      const isHls =
        /\.m3u8(\?|#|$)/i.test(link.url) || /\/hls\//i.test(link.url);

      // ORG is usually the direct file (mkv/mp4). Keep for Nova file fallback.
      if (key === "ORG") {
        if (!isHls) {
          streams.ORG = { type: "mp4", url: link.url };
        }
        continue;
      }

      if (!key) continue;
      streams[key] = { type: isHls ? "hls" : "mp4", url: link.url };
    }
  } catch (err) {
    if (Object.keys(streams).length === 0) {
      // Fall through to master HLS probe below
      void err;
    }
  }

  const hasQualityStreams = Object.keys(streams).length > 0;
  // Only probe www.febbox.com/hls/main when we still need a playlist.
  if (!hasQualityStreams || preferHls) {
    const hlsOk = await isHlsPlayable(primary.oss_fid, ui, shareKey);
    if (hlsOk) {
      streams.ORG = {
        type: "hls",
        url: hlsUrlForOssFid(primary.oss_fid),
      };
    }
  } else {
    // Nova path: quality links often return MKV remuxes (video only in browser).
    // Always offer Febbox's transcoded HLS as a fallback when none is present.
    await appendHlsFallback(streams, primary.oss_fid, ui, shareKey);
  }

  const showboxId = String(entry.id);
  const subtitles = await getShowboxSubtitles({
    showboxId,
    fid: primary.fid,
    type,
    season,
    episode,
  });

  if (Object.keys(streams).length === 0) {
    return {
      streams: {},
      subtitles,
      error: preferHls
        ? "No HLS or MP4 stream available for this title"
        : "No stream found in database",
      shareKey,
      variants,
      primaryFid: String(primary.fid),
      ossFid: String(primary.oss_fid),
      showboxId,
      mediaType: type,
      season,
      episode,
    };
  }

  return {
    streams,
    subtitles,
    name: primary.file_name,
    shareKey,
    variants,
    primaryFid: String(primary.fid),
    ossFid: String(primary.oss_fid),
    showboxId,
    mediaType: type,
    season,
    episode,
  };
}

export async function resolveVariantStreams(
  shareKey: string,
  fid: string,
  ui: string,
  subtitleOpts?: {
    showboxId?: string;
    type?: "movie" | "show";
    season?: number;
    episode?: number;
  },
): Promise<StreamData> {
  const streams: Record<string, StreamEntry | string> = {};
  const links = await getQualityLinks(shareKey, Number(fid), ui);
  for (const link of links) {
    const key = qualityLabelToKey(link.quality) ?? link.quality;
    const isHls =
      /\.m3u8(\?|#|$)/i.test(link.url) || /\/hls\//i.test(link.url);
    streams[key] = { type: isHls ? "hls" : "mp4", url: link.url };
  }

  // Also try to find oss_fid from file list for HLS fallback
  try {
    const files = await getStreamsForMedia(shareKey, ui, "movie");
    const match = files.find((f) => String(f.fid) === String(fid));
    if (match?.oss_fid) {
      await appendHlsFallback(streams, match.oss_fid, ui, shareKey);
    }
  } catch {
    // ignore
  }

  let subtitles: StreamData["subtitles"] = {};
  if (subtitleOpts?.showboxId && subtitleOpts.type) {
    subtitles = await getShowboxSubtitles({
      showboxId: subtitleOpts.showboxId,
      fid,
      type: subtitleOpts.type,
      season: subtitleOpts.season,
      episode: subtitleOpts.episode,
    });
  }

  return {
    streams,
    subtitles,
    shareKey,
    primaryFid: fid,
    showboxId: subtitleOpts?.showboxId,
    mediaType: subtitleOpts?.type,
    season: subtitleOpts?.season,
    episode: subtitleOpts?.episode,
  };
}

export async function resolveByTmdb(opts: {
  ui: string;
  tmdbId: string;
  type: "movie" | "show";
  season?: number;
  episode?: number;
  preferHls?: boolean;
}): Promise<StreamData> {
  const meta = await fetchTmdbTitle(opts.tmdbId, opts.type);
  if (!meta) {
    return { streams: {}, subtitles: {}, error: "TMDB title not found in database" };
  }
  return resolveMediaStreams({
    ui: opts.ui,
    title: meta.title,
    year: meta.year,
    type: opts.type,
    season: opts.season,
    episode: opts.episode,
    preferHls: opts.preferHls,
  });
}

async function fetchTmdbTitle(
  tmdbId: string,
  type: "movie" | "show",
): Promise<{ title: string; year?: number } | null> {
  const cacheKey = `tmdb:${type}:${tmdbId}`;
  const cached = febboxMetaCache.get(cacheKey) as
    | { title: string; year?: number }
    | null
    | undefined;
  if (cached !== undefined) return cached;

  const key = env.TMDB_READ_API_KEY;
  if (!key) return null;

  const path = type === "movie" ? `movie/${tmdbId}` : `tv/${tmdbId}`;
  const url = `https://api.themoviedb.org/3/${path}`;
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${key}`,
      Accept: "application/json",
    },
  });
  if (!res.ok) {
    febboxMetaCache.set(cacheKey, null, 60_000);
    return null;
  }
  const json = (await res.json()) as {
    title?: string;
    name?: string;
    release_date?: string;
    first_air_date?: string;
  };
  const title = json.title || json.name;
  if (!title) {
    febboxMetaCache.set(cacheKey, null, 60_000);
    return null;
  }
  const date = json.release_date || json.first_air_date;
  const year = date ? Number(date.slice(0, 4)) : undefined;
  const meta = { title, year };
  febboxMetaCache.set(cacheKey, meta);
  return meta;
}

export function streamsToGridDownloads(data: StreamData): {
  downloads: Array<{
    title: string;
    format?: string;
    resolution?: string;
    size?: string;
    sources: Array<{ url: string; name: string }>;
  }>;
} {
  const downloads = [];
  for (const [quality, entry] of Object.entries(data.streams)) {
    const url = typeof entry === "string" ? entry : entry.url;
    const type = typeof entry === "string" ? "mp4" : entry.type;
    downloads.push({
      title: data.name || quality,
      format: type.toUpperCase(),
      resolution: quality,
      sources: [{ url, name: quality }],
    });
  }
  return { downloads };
}
