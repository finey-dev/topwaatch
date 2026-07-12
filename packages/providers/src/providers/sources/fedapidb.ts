import { flags } from '@/entrypoint/utils/targets';
import { SourcererOutput, makeSourcerer } from '@/providers/base';
import { MovieScrapeContext, ShowScrapeContext } from '@/utils/context';
import { NotFoundError } from '@/utils/errors';

import { Caption, labelToLanguageCode } from '../captions';
import {
  buildFebboxStreamResults,
  febboxPlaybackHeaders,
  getFebboxBackendUrl,
  getFebboxUserToken,
  isBrowserPlayableDirectFile,
  isHlsUrl,
  isOrgDirectFileUrl,
  streamMediaType,
} from './twFebboxShared';

const META_KEY = '__TW::febboxMeta';

const getRegion = (): string | null => {
  try {
    if (typeof window === 'undefined') return null;
    const regionData = window.localStorage.getItem('__MW::region');
    if (!regionData) return null;
    const parsed = JSON.parse(regionData);
    return parsed?.state?.region ?? null;
  } catch {
    return null;
  }
};

function selectSubdomainByRegion(input: string | null): string | null {
  const region = (input || '').toLowerCase();
  if (/(^|\b)(usa5|usa6|usa7|uk1|de2|hk1|ca1|au1|sg1|in1)(\b|$)/.test(region)) {
    const match = region.match(/(usa5|usa6|usa7|uk1|de2|hk1|ca1|au1|sg1|in1)/);
    if (match) return match[1];
  }
  if (region.includes('dallas')) return 'usa5';
  if (region.includes('portland')) return 'usa6';
  if (region.includes('new-york')) return 'usa7';
  if (region.includes('paris')) return Math.random() < 0.5 ? 'uk1' : 'de2';
  if (region.includes('hong-kong')) return 'hk1';
  if (region.includes('kansas')) return Math.random() < 0.5 ? 'usa7' : 'usa6';
  if (region.includes('sydney')) return 'au1';
  if (region.includes('singapore')) return 'sg1';
  if (region.includes('mumbai')) return 'in1';
  if (region === 'east') return 'usa7';
  if (region === 'west') return 'usa6';
  if (region === 'south') return 'usa5';
  if (region === 'europe') return Math.random() < 0.5 ? 'uk1' : 'de2';
  if (region === 'asia') return 'sg1';
  return null;
}

function rewriteSheguSubdomain(originalUrl: string, subdomain: string): string {
  try {
    // Febbox signed CDN URLs are bound to host + client IP — rewriting breaks them.
    if (/[?&](sign|IP)=/i.test(originalUrl)) return originalUrl;
    if (/[?&]KEY\d+=/i.test(originalUrl)) return originalUrl;
    const parsed = new URL(originalUrl);
    if (parsed.hostname.endsWith('.shegu.net')) {
      parsed.hostname = `${subdomain}.shegu.net`;
      return parsed.toString();
    }
    return originalUrl;
  } catch {
    return originalUrl;
  }
}

interface StreamData {
  streams: Record<string, string | { type: 'hls' | 'mp4'; url: string }>;
  subtitles: Record<string, any>;
  error?: string;
  name?: string;
  shareKey?: string;
  variants?: Array<{
    fid: string;
    name: string;
    quality?: string;
    codec?: string;
    size?: string;
    tag?: 'bw' | 'dv' | 'hdr' | 'remux';
  }>;
  primaryFid?: string;
  ossFid?: string;
  showboxId?: string;
  mediaType?: 'movie' | 'show';
  season?: number;
  episode?: number;
}

function stashMeta(data: StreamData, mode: 'nova' | 'orbit') {
  try {
    if (typeof window === 'undefined') return;
    if (!data.shareKey || !data.variants?.length) return;
    window.sessionStorage.setItem(
      META_KEY,
      JSON.stringify({
        mode,
        shareKey: data.shareKey,
        variants: data.variants,
        primaryFid: data.primaryFid,
        ossFid: data.ossFid,
        showboxId: data.showboxId,
        mediaType: data.mediaType,
        season: data.season,
        episode: data.episode,
      }),
    );
  } catch {
    // ignore
  }
}

function parseStreams(data: StreamData) {
  type StreamInfo = { url: string; type: 'hls' | 'mp4' };
  return Object.entries(data.streams).reduce((acc: Record<string, StreamInfo>, [quality, entry]) => {
    const url = typeof entry === 'string' ? entry : entry.url;
    if (!url) return acc;
    const declared = typeof entry === 'string' ? undefined : entry.type;
    let type = streamMediaType(url, declared);
    if (isHlsUrl(url)) type = 'hls';

    let qualityKey: number | 'unknown';
    if (quality === 'ORG') {
      if (type === 'hls' || isOrgDirectFileUrl(url)) {
        acc.unknown = { url, type };
      }
      return acc;
    }
    if (quality === '4K') {
      qualityKey = 2160;
    } else {
      qualityKey = parseInt(quality.replace('P', ''), 10);
    }
    if (typeof qualityKey === 'number' && (Number.isNaN(qualityKey) || acc[qualityKey])) return acc;
    acc[qualityKey as number] = { url, type };
    return acc;
  }, {});
}

function parseCaptions(data: StreamData): Caption[] {
  const captions: Caption[] = [];
  if (!data.subtitles) return captions;
  for (const [langKey, subtitleData] of Object.entries(data.subtitles)) {
    const languageKeyPart = langKey.split('_')[0];
    const languageName = languageKeyPart.charAt(0).toUpperCase() + languageKeyPart.slice(1);
    const languageCode = labelToLanguageCode(languageName)?.toLowerCase() ?? 'unknown';
    if (subtitleData?.subtitle_link) {
      const url = subtitleData.subtitle_link;
      captions.push({
        type: url.toLowerCase().endsWith('.vtt') ? 'vtt' : 'srt',
        id: url,
        url,
        language: languageCode,
        hasCorsRestrictions: false,
      });
    }
  }
  return captions;
}

async function comboScraper(ctx: ShowScrapeContext | MovieScrapeContext): Promise<SourcererOutput> {
  const userToken = getFebboxUserToken();
  if (!userToken) throw new NotFoundError('Requires a Febbox account  connect one in Settings');

  const region = getRegion();
  const base = getFebboxBackendUrl();
  if (!base) {
    throw new NotFoundError(
      'Backend URL is not configured — set VITE_BACKEND_URL for TopWaatch Orbit',
    );
  }
  ctx.progress(50);

  const apiUrl =
    ctx.media.type === 'movie'
      ? `${base}/febbox/movie/${ctx.media.tmdbId}?ui=${encodeURIComponent(userToken)}&hls=1`
      : `${base}/febbox/tv/${ctx.media.tmdbId}/${ctx.media.season.number}/${ctx.media.episode.number}?ui=${encodeURIComponent(userToken)}&hls=1`;

  let data: StreamData;
  try {
    data = await ctx.fetcher<StreamData>(apiUrl);
  } catch (err) {
    throw new NotFoundError(
      err instanceof Error ? err.message : 'TopWaatch Orbit request failed',
    );
  }

  if (data?.error) throw new NotFoundError(data.error);
  if (!data?.streams || Object.keys(data.streams).length === 0) {
    throw new NotFoundError('No stream found');
  }

  stashMeta(data, 'orbit');
  ctx.progress(90);

  const subdomain = selectSubdomainByRegion(region);
  const parsed = parseStreams(data);
  if (subdomain) {
    for (const entry of Object.values(parsed)) {
      entry.url = rewriteSheguSubdomain(entry.url, subdomain);
    }
  }

  const stream = buildFebboxStreamResults({
    prefer: 'hls',
    streams: parsed,
    captions: parseCaptions(data),
    headers: febboxPlaybackHeaders(userToken),
  });

  if (stream.length === 0) {
    throw new NotFoundError('No HLS or MP4 stream available');
  }

  return { embeds: [], stream };
}

export const FedAPIDBScraper = makeSourcerer({
  id: 'tw-orbit',
  name: 'TopWaatch Orbit',
  rank: 299,
  flags: [flags.CORS_ALLOWED],
  scrapeMovie: comboScraper,
  scrapeShow: comboScraper,
});
