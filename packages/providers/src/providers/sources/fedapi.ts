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
  isOrgDirectFileUrl,
  streamMediaType,
} from './twFebboxShared';

const META_KEY = '__TW::febboxMeta';

interface StreamEntry {
  type: 'hls' | 'mp4';
  url: string;
}

interface StreamData {
  streams: Record<string, StreamEntry | string>;
  subtitles: Record<string, any>;
  error?: string;
  name?: string;
  size?: string;
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
    const type = streamMediaType(url, declared);

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
      const isVtt = url.toLowerCase().endsWith('.vtt');
      captions.push({
        type: isVtt ? 'vtt' : 'srt',
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

  const base = getFebboxBackendUrl();
  if (!base) {
    throw new NotFoundError(
      'Backend URL is not configured  set VITE_BACKEND_URL for TopWaatch Nova',
    );
  }

  ctx.progress(40);
  let apiUrl = `${base}/febbox/fedapi?name=${encodeURIComponent(ctx.media.title)}&year=${ctx.media.releaseYear}&ui=${encodeURIComponent(userToken)}`;
  if (ctx.media.type === 'show') {
    apiUrl += `&season=${ctx.media.season.number}&episode=${ctx.media.episode.number}`;
  }

  let data: StreamData;
  try {
    const res = await fetch(apiUrl, { credentials: 'omit' });
    if (!res.ok) {
      throw new NotFoundError(`TopWaatch Nova API failed (${res.status})`);
    }
    data = await res.json();
  } catch (err) {
    if (err instanceof NotFoundError) throw err;
    throw new NotFoundError(
      err instanceof Error ? err.message : 'TopWaatch Nova request failed',
    );
  }

  if (data?.error) throw new NotFoundError(data.error);
  if (!data?.streams || Object.keys(data.streams).length === 0) {
    throw new NotFoundError('No stream found');
  }

  stashMeta(data, 'nova');
  ctx.progress(90);

  const parsed = parseStreams(data);
  const captions = parseCaptions(data);
  const stream = buildFebboxStreamResults({
    prefer: 'mp4',
    streams: parsed,
    captions,
    headers: febboxPlaybackHeaders(userToken),
  });

  if (stream.length === 0) {
    throw new NotFoundError('No HLS or MP4 stream available');
  }

  return { embeds: [], stream };
}

export const FedAPIScraper = makeSourcerer({
  id: 'tw-nova',
  name: 'TopWaatch Nova',
  rank: 300,
  flags: [flags.CORS_ALLOWED],
  scrapeMovie: comboScraper,
  scrapeShow: comboScraper,
});
