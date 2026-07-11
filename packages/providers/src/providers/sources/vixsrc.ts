import { flags } from '@/entrypoint/utils/targets';
import { SourcererOutput, makeSourcerer } from '@/providers/base';
import { MovieScrapeContext, ShowScrapeContext } from '@/utils/context';
import { NotFoundError } from '@/utils/errors';

const BASE_URL = 'https://vixsrc.to';

const headers = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150 Safari/537.36',
  Accept: 'application/json, text/javascript, */*; q=0.01',
  'Accept-Language': 'en-US,en;q=0.9',
  Referer: BASE_URL,
  Origin: BASE_URL,
};

interface VixSrcApiResponse {
  src: string;
}

async function comboScraper(ctx: ShowScrapeContext | MovieScrapeContext): Promise<SourcererOutput> {
  ctx.progress(10);

  const { tmdbId } = ctx.media;
  const apiUrl =
    ctx.media.type === 'movie'
      ? `${BASE_URL}/api/movie/${tmdbId}`
      : `${BASE_URL}/api/tv/${tmdbId}/${ctx.media.season.number}/${ctx.media.episode.number}`;

  const apiData = await ctx.proxiedFetcher<VixSrcApiResponse>(apiUrl, { headers });

  if (!apiData?.src) throw new NotFoundError('Failed to get embed source from VixSrc API');

  ctx.progress(35);

  // apiData.src is a path like "/embed/movie/12345?..."
  const embedPageUrl = `${BASE_URL}${apiData.src}`;
  const embedHtml = await ctx.proxiedFetcher<string>(embedPageUrl, { headers });

  if (!embedHtml) throw new NotFoundError('Failed to fetch VixSrc embed page');

  ctx.progress(60);

  const htmlStr = typeof embedHtml === 'string' ? embedHtml : JSON.stringify(embedHtml);

  const token = htmlStr.match(/token["']\s*:\s*["']([^"']+)/)?.[1];
  const expires = htmlStr.match(/expires["']\s*:\s*["']([^"']+)/)?.[1];
  const playlist = htmlStr.match(/url\s*:\s*["']([^"']+)/)?.[1];

  if (!token || !expires || !playlist) {
    throw new NotFoundError('Invalid or missing token data in VixSrc embed page');
  }

  if (parseInt(expires, 10) * 1000 - 60_000 < Date.now()) {
    throw new NotFoundError('VixSrc token has expired');
  }

  const separator = playlist.includes('?') ? '&' : '?';
  const masterUrl = `${playlist}${separator}token=${token}&expires=${expires}&h=1`;

  ctx.progress(90);

  return {
    embeds: [],
    stream: [
      {
        id: 'primary',
        type: 'hls',
        playlist: masterUrl,
        captions: [],
        // CDN segments allow browser CORS but block Cloudflare/datacenter IPs.
        flags: [flags.CORS_ALLOWED, flags.IP_LOCKED],
        headers: {
          ...headers,
          Referer: embedPageUrl,
        },
      },
    ],
  };
}

export const vixsrcScraper = makeSourcerer({
  id: 'vixsrc',
  name: 'VixSrc',
  rank: 215,
  disabled: false,
  flags: [],
  scrapeMovie: comboScraper,
  scrapeShow: comboScraper,
});
