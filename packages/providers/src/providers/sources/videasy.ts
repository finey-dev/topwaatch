import { SourcererOutput, makeSourcerer } from '@/providers/base';
import { Qualities } from '@/providers/streams';
import { MovieScrapeContext, ShowScrapeContext } from '@/utils/context';
import { NotFoundError } from '@/utils/errors';

/**
 * Videasy fans out to multiple backend servers, each returning an encrypted
 * hex blob. The blob is decrypted server-side by enc-dec.app (same service
 * used by other TopWaatch scrapers like VidLink). Active English servers only.
 */

const DEC_API = 'https://enc-dec.app/api/dec-videasy';

const VIDEASY_SERVERS = [
  { name: 'cuevana', url: 'https://api2.videasy.net/cuevana/sources-with-title' },
  { name: 'mb-flix', url: 'https://api.videasy.net/mb-flix/sources-with-title' },
  { name: '1movies', url: 'https://api.videasy.net/1movies/sources-with-title' },
  { name: 'cdn', url: 'https://api.videasy.net/cdn/sources-with-title' },
  { name: 'superflix', url: 'https://api.videasy.net/superflix/sources-with-title' },
  { name: 'lamovie', url: 'https://api.videasy.net/lamovie/sources-with-title' },
] as const;

type VideasyServer = (typeof VIDEASY_SERVERS)[number];

const HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  Accept: 'application/json, */*; q=0.01',
  Referer: 'https://player.videasy.net/',
  Origin: 'https://player.videasy.net',
};

interface DecryptedSource {
  quality?: string;
  url: string;
  type?: string;
}

interface DecApiResponse {
  status: number;
  result?: {
    sources: DecryptedSource[];
    subtitles: Array<{ url: string; lang?: string; language?: string }>;
  };
}

function normalizeQuality(raw?: string): Qualities {
  if (!raw) return 'unknown';
  const v = raw.toLowerCase().trim();
  if (v.includes('4k') || v.includes('2160')) return '4k';
  if (v.includes('1080')) return '1080';
  if (v.includes('720')) return '720';
  if (v.includes('480')) return '480';
  if (v.includes('360')) return '360';
  // Pure numeric (e.g. "1080", "720")
  const num = parseInt(raw, 10);
  if (!isNaN(num)) {
    if (num >= 2000) return '4k';
    if (num >= 900) return '1080';
    if (num >= 600) return '720';
    if (num >= 400) return '480';
    if (num >= 300) return '360';
  }
  return 'unknown';
}

function detectStreamType(url: string, hint?: string): 'hls' | 'mp4' {
  const lower = (hint ?? '').toLowerCase();
  if (lower.includes('hls') || lower.includes('m3u8') || url.toLowerCase().includes('.m3u8')) return 'hls';
  return 'mp4';
}

async function fetchServerSources(
  ctx: ShowScrapeContext | MovieScrapeContext,
  server: VideasyServer,
): Promise<{ hlsUrls: string[]; mp4Sources: Partial<Record<Qualities, { type: 'mp4'; url: string }>> }> {
  const empty = { hlsUrls: [], mp4Sources: {} };
  try {
    const params: Record<string, string> = {
      title: ctx.media.title,
      mediaType: ctx.media.type === 'movie' ? 'movie' : 'tv',
      tmdbId: ctx.media.tmdbId,
      imdbId: ctx.media.imdbId ?? '',
      episodeId: String(ctx.media.type === 'show' ? ctx.media.episode.number : 1),
      seasonId: String(ctx.media.type === 'show' ? ctx.media.season.number : 1),
      language: 'english',
    };
    if (ctx.media.type === 'movie') {
      params.year = String(ctx.media.releaseYear);
    }

    const blob = await ctx.proxiedFetcher<string>(`${server.url}?${new URLSearchParams(params).toString()}`, {
      headers: HEADERS,
    });

    // Videasy returns a plain text hex blob — if it looks like JSON it wasn't a valid blob
    if (!blob || typeof blob !== 'string' || blob.length < 10) return empty;
    if (blob.trim().startsWith('{') || blob.trim().startsWith('[')) return empty;

    const decData = await ctx.proxiedFetcher<DecApiResponse>(DEC_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: blob, id: ctx.media.tmdbId }),
    });

    if (!decData || decData.status !== 200 || !decData.result?.sources?.length) return empty;

    const hlsUrls: string[] = [];
    const mp4Sources: Partial<Record<Qualities, { type: 'mp4'; url: string }>> = {};

    for (const source of decData.result.sources) {
      if (!source?.url) continue;
      if (detectStreamType(source.url, source.type) === 'hls') {
        hlsUrls.push(source.url);
      } else {
        const q = normalizeQuality(source.quality);
        if (!mp4Sources[q]) {
          mp4Sources[q] = { type: 'mp4', url: source.url };
        }
      }
    }

    return { hlsUrls, mp4Sources };
  } catch {
    return empty;
  }
}

async function comboScraper(ctx: ShowScrapeContext | MovieScrapeContext): Promise<SourcererOutput> {
  ctx.progress(10);

  const results = await Promise.allSettled(VIDEASY_SERVERS.map((server) => fetchServerSources(ctx, server)));

  ctx.progress(80);

  const allHlsUrls = new Set<string>();
  const mergedMp4: Partial<Record<Qualities, { type: 'mp4'; url: string }>> = {};

  for (const r of results) {
    if (r.status !== 'fulfilled') continue;
    for (const url of r.value.hlsUrls) allHlsUrls.add(url);
    for (const [q, src] of Object.entries(r.value.mp4Sources) as [Qualities, { type: 'mp4'; url: string }][]) {
      if (!mergedMp4[q]) mergedMp4[q] = src;
    }
  }

  if (allHlsUrls.size === 0 && Object.keys(mergedMp4).length === 0) {
    throw new NotFoundError('No sources found from Videasy');
  }

  ctx.progress(90);

  const streams: SourcererOutput['stream'] = [];

  let i = 0;
  for (const playlist of allHlsUrls) {
    streams.push({ id: `videasy-${i++}`, type: 'hls', playlist, captions: [], flags: [], headers: HEADERS });
  }

  if (Object.keys(mergedMp4).length > 0) {
    streams.push({ id: 'videasy-file', type: 'file', qualities: mergedMp4, captions: [], flags: [], headers: HEADERS });
  }

  return { embeds: [], stream: streams };
}

export const videasysScraper = makeSourcerer({
  id: 'videasy',
  name: 'Videasy',
  rank: 230,
  disabled: false,
  flags: [],
  scrapeMovie: comboScraper,
  scrapeShow: comboScraper,
});
