import { SourcererOutput, makeSourcerer } from '@/providers/base';
import { MovieScrapeContext, ShowScrapeContext } from '@/utils/context';
import { NotFoundError } from '@/utils/errors';

const BASE_URL = 'https://cine.su';

const headers = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150 Safari/537.36',
  Accept: 'application/json, text/javascript, */*; q=0.01',
  'Accept-Language': 'en-US,en;q=0.9',
  Referer: `${BASE_URL}/en/watch`,
  Origin: BASE_URL,
};

function buildM3U8Url(ctx: ShowScrapeContext | MovieScrapeContext): string {
  const { tmdbId } = ctx.media;
  if (ctx.media.type === 'movie') {
    return `${BASE_URL}/v1/stream/master/movie/${tmdbId}.m3u8`;
  }
  return `${BASE_URL}/v1/stream/master/tv/${tmdbId}/${ctx.media.season.number}/${ctx.media.episode.number}.m3u8`;
}

async function comboScraper(ctx: ShowScrapeContext | MovieScrapeContext): Promise<SourcererOutput> {
  ctx.progress(20);

  const m3u8Url = buildM3U8Url(ctx);

  // Validate the stream URL is reachable before returning it
  const testRes = await ctx.proxiedFetcher<string>(m3u8Url, {
    headers,
    method: 'GET',
  });

  ctx.progress(70);

  if (!testRes) throw new NotFoundError('Stream not available from CineSu');

  ctx.progress(90);

  return {
    embeds: [],
    stream: [
      {
        id: 'primary',
        type: 'hls',
        playlist: m3u8Url,
        captions: [],
        flags: [],
        headers,
      },
    ],
  };
}

export const cinesuScraper = makeSourcerer({
  id: 'cinesu',
  name: 'CineSu',
  rank: 189,
  disabled: false,
  flags: [],
  scrapeMovie: comboScraper,
  scrapeShow: comboScraper,
});
