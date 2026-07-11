import { SourcererOutput, makeSourcerer } from '@/providers/base';
import { Caption } from '@/providers/captions';
import { MovieScrapeContext, ShowScrapeContext } from '@/utils/context';
import { NotFoundError } from '@/utils/errors';
import { decrypt, deriveKey } from './decrypt';

/**
 * VidZee fans out to 14 parallel server slots (sr=0..13). Each slot returns
 * a list of AES-CBC-encrypted stream URLs plus optional subtitle tracks.
 * All encrypted URLs are decrypted in parallel using a key fetched from the API.
 */

const CORE_URL = 'https://core.vidzee.wtf';
const PLAYER_URL = 'https://player.vidzee.wtf';
const SERVER_COUNT = 14;

const HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (X11; Ubuntu; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.7051.98 Safari/537.36',
  Accept: 'application/json, text/javascript, */*; q=0.01',
  'Accept-Language': 'en-US,en;q=0.9',
  Referer: PLAYER_URL,
  Origin: PLAYER_URL,
};

interface StreamUrl {
  lang: string;
  link: string;
  type: 'hls' | string;
  message: string;
  name: string;
  flag: string;
}

interface Track {
  lang: string;
  url: string;
}

interface ServerInfo {
  number: number;
  name: string;
  flag: string;
  language: string;
}

interface StreamResponse {
  url: StreamUrl[];
  tracks: Track[];
  serverInfo: ServerInfo;
  proxy?: boolean;
}

async function fetchDecryptionKey(ctx: ShowScrapeContext | MovieScrapeContext): Promise<string> {
  try {
    const raw = await ctx.proxiedFetcher<string>(`${CORE_URL}/api-key`, { headers: HEADERS });
    if (!raw || typeof raw !== 'string') return '';
    return deriveKey(raw);
  } catch {
    return '';
  }
}

async function fetchServer(
  ctx: ShowScrapeContext | MovieScrapeContext,
  serverId: number,
): Promise<StreamResponse | null> {
  try {
    const { tmdbId } = ctx.media;
    let url = `${PLAYER_URL}/api/server?id=${tmdbId}&sr=${serverId}`;
    if (ctx.media.type === 'show') {
      url += `&ss=${ctx.media.season.number}&ep=${ctx.media.episode.number}`;
    }
    const data = await ctx.proxiedFetcher<StreamResponse>(url, { headers: HEADERS });
    if (!data?.url?.length) return null;
    return data;
  } catch {
    return null;
  }
}

async function comboScraper(ctx: ShowScrapeContext | MovieScrapeContext): Promise<SourcererOutput> {
  ctx.progress(10);

  const decKey = await fetchDecryptionKey(ctx);
  if (!decKey) throw new NotFoundError('Failed to fetch VidZee decryption key');

  ctx.progress(20);

  const serverResults = await Promise.allSettled(
    Array.from({ length: SERVER_COUNT }, (_, i) => fetchServer(ctx, i)),
  );

  ctx.progress(65);

  const successful = serverResults
    .filter((r): r is PromiseFulfilledResult<StreamResponse> => r.status === 'fulfilled' && r.value !== null)
    .map((r) => r.value);

  if (successful.length === 0) throw new NotFoundError('No VidZee servers returned data');

  // Decrypt all encrypted stream URLs in parallel across all servers
  const decryptJobs = successful.flatMap((resp) =>
    resp.url.filter((u) => u.link).map(async (u) => ({
      decryptedUrl: await decrypt(u.link, decKey),
      serverInfo: resp.serverInfo,
      tracks: resp.tracks,
    })),
  );

  const decryptedResults = await Promise.all(decryptJobs);

  ctx.progress(85);

  const seenUrls = new Set<string>();
  const subtitleMap = new Map<string, Caption>();
  const streams: SourcererOutput['stream'] = [];

  for (const { decryptedUrl, serverInfo, tracks } of decryptedResults) {
    if (!decryptedUrl || !decryptedUrl.startsWith('http')) continue;
    if (seenUrls.has(decryptedUrl)) continue;
    seenUrls.add(decryptedUrl);

    // Collect subtitles from this server's tracks
    for (const track of tracks) {
      if (!track.url || !track.lang) continue;
      const subKey = `${track.lang}_${serverInfo.number}`;
      if (!subtitleMap.has(subKey)) {
        subtitleMap.set(subKey, {
          id: subKey,
          url: track.url,
          language: track.lang.replace(/\d+/g, '').trim(),
          type: 'vtt',
          hasCorsRestrictions: false,
        });
      }
    }

    const captions: Caption[] = Array.from(subtitleMap.values());

    const streamHeaders: Record<string, string> = {
      ...HEADERS,
      Referer: `${CORE_URL}/`,
    };

    streams.push({
      id: `vidzee-${serverInfo.number}-${streams.length}`,
      type: 'hls',
      playlist: decryptedUrl,
      captions,
      flags: [],
      headers: streamHeaders,
    });
  }

  if (streams.length === 0) throw new NotFoundError('No decryptable streams from VidZee');

  ctx.progress(90);

  return { embeds: [], stream: streams };
}

export const vidzeeScraper = makeSourcerer({
  id: 'vidzee',
  name: 'VidZee',
  rank: 240,
  disabled: false,
  flags: [],
  scrapeMovie: comboScraper,
  scrapeShow: comboScraper,
});
