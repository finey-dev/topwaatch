import { flags } from '@/entrypoint/utils/targets';
import { SourcererOutput, makeSourcerer } from '@/providers/base';
import { MovieScrapeContext, ShowScrapeContext } from '@/utils/context';
import { NotFoundError } from '@/utils/errors';

const BASE_URL = 'https://popr.ink';

const SERVERS = ['default', 'catflix', 'hexa', 'Gama', 'Liligoon', 'Sigma', 'Prime', 'Alfa', 'Lamda', 'ynx_vidsrc'];

const headers = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150 Safari/537.36',
  Referer: `${BASE_URL}/`,
};

interface PoprStream {
  url: string;
  quality?: string;
  headers?: Record<string, string>;
}

interface PoprSubtitle {
  url: string;
  lang?: string;
}

interface PoprResult {
  streams?: PoprStream[];
  subtitles?: PoprSubtitle[];
}

interface PoprApiResponse {
  results?: PoprResult[];
}

async function comboScraper(ctx: ShowScrapeContext | MovieScrapeContext): Promise<SourcererOutput> {
  ctx.progress(10);

  const { tmdbId } = ctx.media;
  const mediaType = ctx.media.type === 'show' ? 'tv' : 'movie';
  const season = ctx.media.type === 'show' ? ctx.media.season.number : 1;
  const episode = ctx.media.type === 'show' ? ctx.media.episode.number : 1;

  const buildApiUrl = (server: string): string => {
    if (mediaType === 'tv') {
      return `${BASE_URL}/api/vidnest?id=${tmdbId}&type=tv&server=${server}&season=${season}&episode=${episode}`;
    }
    return `${BASE_URL}/api/vidnest?id=${tmdbId}&type=movie${server !== 'default' ? `&server=${server}` : ''}`;
  };

  const results = await Promise.allSettled(
    SERVERS.map(async (server) => {
      try {
        const data = await ctx.proxiedFetcher<PoprApiResponse>(buildApiUrl(server), { headers });
        const stream = data?.results?.[0]?.streams?.[0];
        if (!stream?.url) return null;
        return {
          url: stream.url,
          quality: stream.quality,
          streamHeaders: stream.headers ?? {},
        };
      } catch {
        return null;
      }
    }),
  );

  ctx.progress(80);

  type ServerResult = { url: string; quality?: string; streamHeaders: Record<string, string> };

  const embeds = (results.filter((r) => r.status === 'fulfilled' && r.value !== null) as PromiseFulfilledResult<ServerResult>[])
    .map((r) => r.value)
    .map((s) => ({
      embedId: 'mirror',
      url: JSON.stringify({
        type: 'hls',
        stream: s.url,
        headers: { ...headers, ...s.streamHeaders },
        flags: [flags.CORS_ALLOWED],
        captions: [],
      }),
    }));

  if (embeds.length === 0) throw new NotFoundError('No valid streams found from Popr');

  ctx.progress(90);

  return { embeds };
}

export const poprScraper = makeSourcerer({
  id: 'popr',
  name: 'Popr',
  rank: 225,
  disabled: false,
  flags: [],
  scrapeMovie: comboScraper,
  scrapeShow: comboScraper,
});
