import { flags } from '@/entrypoint/utils/targets';
import { SourcererOutput, makeSourcerer } from '@/providers/base';
import { MovieScrapeContext, ShowScrapeContext } from '@/utils/context';
import { NotFoundError } from '@/utils/errors';
import { decryptPayload } from './decrypt';
import { extractUrl } from './mapper';

/**
 * Tulnex fans out to 14 distinct backend servers. Each server returns an
 * encrypted payload (4-layer: HMAC-SHA512 → AES-CBC → binary decode → XOR).
 * Decryption is done entirely client-side using the Web Crypto API.
 */

const BASE_URL = 'https://api.tulnex.com';

const SERVERS = [
  'onion',
  'vidzee',
  'icefy',
  'tik',
  'vaplayer',
  'vidfast-alpha',
  'uniquestream',
  'vidfast-mega',
  'vidfast-vrapid',
  'allmovies',
  'vidlink',
  'vidfast-vedge',
  'vidfast-vfast',
  'moviebox',
] as const;

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
  accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
  'accept-language': 'en-US,en;q=0.9',
  'cache-control': 'no-cache',
};

interface TulnexApiResponse {
  v: string;
  payload: string;
}

async function fetchFromServer(
  ctx: ShowScrapeContext | MovieScrapeContext,
  server: string,
): Promise<{ url: string; serverHeaders: Record<string, string> | null } | null> {
  try {
    const path =
      ctx.media.type === 'movie'
        ? `/${server}/movie/${ctx.media.tmdbId}`
        : `/${server}/tv/${ctx.media.tmdbId}/${ctx.media.season.number}/${ctx.media.episode.number}`;

    const data = await ctx.proxiedFetcher<TulnexApiResponse>(`${BASE_URL}${path}`, {
      headers: { ...HEADERS, Accept: 'application/json, */*' },
    });

    if (!data?.payload) return null;

    const decrypted = await decryptPayload(data.payload);
    if (!decrypted) return null;

    const extracted = extractUrl(decrypted);
    if (!extracted) return null;

    return { url: extracted.url, serverHeaders: extracted.headers };
  } catch {
    return null;
  }
}

async function comboScraper(ctx: ShowScrapeContext | MovieScrapeContext): Promise<SourcererOutput> {
  ctx.progress(10);

  const results = await Promise.allSettled(SERVERS.map((server) => fetchFromServer(ctx, server)));

  ctx.progress(80);

  type ServerResult = { url: string; serverHeaders: Record<string, string> | null };
  const streams = (
    results.filter((r) => r.status === 'fulfilled' && r.value !== null) as PromiseFulfilledResult<ServerResult>[]
  )
    .map((r) => r.value)
    .map((s, i) => ({
      embedId: 'mirror',
      url: JSON.stringify({
        type: s.url.includes('.mp4') || s.url.includes('.mkv') ? 'file' : 'hls',
        stream: s.url,
        headers: { ...HEADERS, ...(s.serverHeaders ?? {}) },
        flags: [flags.CORS_ALLOWED],
        captions: [],
        // Use skipvalid so the mirror embed doesn't double-validate
        skipvalid: true,
      }),
    }));

  if (streams.length === 0) throw new NotFoundError('No valid streams found from Tulnex');

  ctx.progress(90);

  return { embeds: streams };
}

export const tulnexScraper = makeSourcerer({
  id: 'tulnex',
  name: 'Tulnex',
  rank: 235,
  disabled: false,
  flags: [],
  scrapeMovie: comboScraper,
  scrapeShow: comboScraper,
});
