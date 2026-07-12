import { flags } from '@/entrypoint/utils/targets';
import { Caption } from '@/providers/captions';
import { Stream } from '@/providers/streams';

/** Server scrape context — Cinema scrapers read this when `window` is unavailable. */
export type FebboxScrapeContext = {
  febboxKey?: string | null;
  backendUrl?: string | null;
};

let serverScrapeContext: FebboxScrapeContext = {};

export function setFebboxScrapeContext(ctx: FebboxScrapeContext) {
  serverScrapeContext = {
    febboxKey: ctx.febboxKey?.trim() || null,
    backendUrl: ctx.backendUrl?.replace(/\/$/, '') || null,
  };
}

export function clearFebboxScrapeContext() {
  serverScrapeContext = {};
}

export function getFebboxUserToken(): string | null {
  if (serverScrapeContext.febboxKey) return serverScrapeContext.febboxKey;
  try {
    if (typeof window === 'undefined') return null;
    const prefData = window.localStorage.getItem('__MW::preferences');
    if (!prefData) return null;
    const parsed = JSON.parse(prefData);
    return parsed?.state?.febboxKey || null;
  } catch {
    return null;
  }
}

/** Prefer scrape context / auth store, then window config, then localhost. */
export function getFebboxBackendUrl(): string {
  if (serverScrapeContext.backendUrl) return serverScrapeContext.backendUrl;
  // Server-side scrapes (no window): fall back to auth URL env when context
  // was not set (e.g. older callers).
  if (typeof window === 'undefined') {
    const envUrl =
      typeof process !== 'undefined'
        ? process.env.BETTER_AUTH_URL || process.env.VITE_BACKEND_URL
        : undefined;
    if (typeof envUrl === 'string' && envUrl.length > 0) {
      return envUrl.replace(/\/$/, '');
    }
  }
  try {
    if (typeof window !== 'undefined') {
      const auth = window.localStorage.getItem('__MW::auth');
      if (auth) {
        const parsed = JSON.parse(auth);
        const url = parsed?.state?.backendUrl;
        if (typeof url === 'string' && url.length > 0) return url.replace(/\/$/, '');
      }
      if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        return 'http://localhost:3000';
      }
      // Vite build-time env is exposed on window by apps/web (see providers.ts).
      const runtimeUrl = (window as { __TW_BACKEND_URL__?: string }).__TW_BACKEND_URL__;
      if (typeof runtimeUrl === 'string' && runtimeUrl.length > 0) {
        return runtimeUrl.replace(/\/$/, '');
      }
      // Fall back to the runtime config injected via public/config.js
      const configUrl = (window as { __CONFIG__?: { VITE_BACKEND_URL?: string | null } }).__CONFIG__
        ?.VITE_BACKEND_URL;
      if (typeof configUrl === 'string' && configUrl.length > 0) {
        return configUrl.replace(/\/$/, '');
      }
    }
  } catch {
    // ignore
  }
  return '';
}

export function isHlsUrl(url: string): boolean {
  return /\.m3u8(\?|#|$)/i.test(url) || /\/hls\//i.test(url);
}

export function isMkvUrl(url: string): boolean {
  const path = url.split('?')[0]?.toLowerCase() ?? '';
  return path.endsWith('.mkv');
}

/**
 * Direct file URLs browsers can play with working audio.
 * MKV remuxes often decode video but not AC3/DTS audio tracks.
 */
export function isOrgDirectFileUrl(url: string): boolean {
  if (isHlsUrl(url) || isMkvUrl(url)) return false;
  const path = url.split('?')[0]?.toLowerCase() ?? '';
  return path.endsWith('.mp4') || path.endsWith('.webm');
}

/** Labeled Febbox/shegu qualities — still probe-reject MKV containers. */
export function isBrowserPlayableDirectFile(url: string): boolean {
  if (isHlsUrl(url) || isMkvUrl(url)) return false;
  if (isOrgDirectFileUrl(url)) return true;
  return /shegu\.net/i.test(url) || /febbox\.com/i.test(url);
}

export function isLikelyMp4Url(url: string): boolean {
  if (isHlsUrl(url)) return false;
  const path = url.split('?')[0]?.toLowerCase() ?? '';
  return (
    path.endsWith('.mp4') ||
    path.endsWith('.mkv') ||
    path.endsWith('.webm') ||
    /shegu\.net/i.test(url) ||
    /febbox\.com/i.test(url)
  );
}

export function streamMediaType(
  url: string,
  declared?: 'hls' | 'mp4',
): 'hls' | 'mp4' {
  if (isHlsUrl(url)) return 'hls';
  if (declared === 'hls' || declared === 'mp4') return declared;
  return isLikelyMp4Url(url) ? 'mp4' : 'mp4';
}

export function febboxPlaybackHeaders(ui: string): Record<string, string> {
  return {
    Cookie: `ui=${ui}`,
    Referer: 'https://www.febbox.com/',
    Origin: 'https://www.febbox.com',
  };
}

/**
 * Febbox/shegu HLS uses large fMP4 (.m4s) segments with CDN CORS *.
 * Proxying each segment through ts-proxy exceeds Worker CPU — browser loads direct.
 */
export function playlistNeedsDirectSegments(url: string): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return (
      host.endsWith('.shegu.net') ||
      host.includes('vix-content.net') ||
      host.endsWith('febbox.com')
    );
  } catch {
    return /shegu\.net|vix-content\.net|febbox\.com/i.test(url);
  }
}

type Parsed = { url: string; type: 'hls' | 'mp4' };

/** Prefer highest listed quality for HLS playlists. */
export function pickBestHls(streams: Record<string, Parsed>): Parsed | null {
  for (const q of [2160, 1080, 720, 480, 360] as const) {
    if (streams[q]?.type === 'hls') return streams[q];
  }
  if (streams.unknown?.type === 'hls') return streams.unknown;
  return Object.values(streams).find((s) => s.type === 'hls') ?? null;
}

function addMp4Quality(
  qualities: NonNullable<Extract<Stream, { type: 'file' }>['qualities']>,
  key: keyof NonNullable<Extract<Stream, { type: 'file' }>['qualities']>,
  entry?: Parsed,
) {
  if (entry?.type !== 'mp4' || !isBrowserPlayableDirectFile(entry.url)) return;
  qualities[key] = { type: 'mp4', url: entry.url };
}

export function buildMp4Qualities(
  streams: Record<string, Parsed>,
): NonNullable<Extract<Stream, { type: 'file' }>['qualities']> {
  const qualities: NonNullable<Extract<Stream, { type: 'file' }>['qualities']> =
    {};
  addMp4Quality(qualities, '4k', streams[2160]);
  addMp4Quality(qualities, '1080', streams[1080]);
  addMp4Quality(qualities, '720', streams[720]);
  addMp4Quality(qualities, '480', streams[480]);
  addMp4Quality(qualities, '360', streams[360]);
  if (streams.unknown?.type === 'mp4' && isOrgDirectFileUrl(streams.unknown.url)) {
    qualities.unknown = { type: 'mp4', url: streams.unknown.url };
  }
  return qualities;
}

/**
 * Build ordered stream candidates.
 * Nova: MP4 first, then HLS. Orbit: HLS first, then MP4.
 * Runner validates all and keeps whatever is playable.
 */
export function buildFebboxStreamResults(opts: {
  prefer: 'mp4' | 'hls';
  streams: Record<string, Parsed>;
  captions: Caption[];
  headers: Record<string, string>;
}): Stream[] {
  const hls = pickBestHls(opts.streams);
  const qualities = buildMp4Qualities(opts.streams);
  const hasMp4 = Object.keys(qualities).length > 0;

  const hlsStream: Stream | null = hls
    ? {
        id: 'primary-hls',
        captions: opts.captions,
        playlist: hls.url,
        type: 'hls',
        headers: opts.headers,
        // IP_LOCKED is disallowed for browser targets and would drop HLS before validation.
        // Segment URLs are loaded direct via playlistNeedsDirectSegments at playback.
        flags: [flags.CORS_ALLOWED],
      }
    : null;

  const fileStream: Stream | null = hasMp4
    ? {
        id: 'primary-file',
        captions: opts.captions,
        qualities,
        type: 'file',
        headers: opts.headers,
        flags: [flags.CORS_ALLOWED],
      }
    : null;

  const hasLabeledMp4 = Object.keys(qualities).some((key) => key !== 'unknown');
  // No labeled MP4 qualities (only MKV remux was dropped) — use transcoded HLS.
  const effectivePrefer = hlsStream && !hasLabeledMp4 ? 'hls' : opts.prefer;

  const out: Stream[] = [];
  if (effectivePrefer === 'mp4') {
    if (fileStream) out.push(fileStream);
    if (hlsStream) out.push(hlsStream);
  } else {
    if (hlsStream) out.push(hlsStream);
    if (fileStream) out.push(fileStream);
  }
  return out;
}
