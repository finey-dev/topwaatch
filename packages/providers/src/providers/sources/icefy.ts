import { SourcererOutput, makeSourcerer } from '@/providers/base';
import { MovieScrapeContext, ShowScrapeContext } from '@/utils/context';
import { NotFoundError } from '@/utils/errors';

const BASE_URL = 'https://streams.icefy.top';

const headers = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150 Safari/537.36',
  Accept: 'application/json, text/javascript, */*; q=0.01',
  'Accept-Language': 'en-US,en;q=0.9',
  Referer: BASE_URL,
  Origin: BASE_URL,
};

async function comboScraper(ctx: ShowScrapeContext | MovieScrapeContext): Promise<SourcererOutput> {
  ctx.progress(20);

  const { tmdbId } = ctx.media;
  let apiUrl: string;

  if (ctx.media.type === 'movie') {
    apiUrl = `${BASE_URL}/movie/${tmdbId}`;
  } else {
    apiUrl = `${BASE_URL}/tv/${tmdbId}/${ctx.media.season.number}/${ctx.media.episode.number}`;
  }

  const data = await ctx.proxiedFetcher<{ stream: string }>(apiUrl, { headers });

  ctx.progress(70);

  if (!data?.stream) throw new NotFoundError('No stream URL returned from Icefy');

  ctx.progress(90);

  return {
    embeds: [],
    stream: [
      {
        id: 'primary',
        type: 'hls',
        playlist: data.stream,
        captions: [],
        flags: [],
        headers,
      },
    ],
  };
}

export const icefyScraper = makeSourcerer({
  id: 'icefy',
  name: 'Icefy',
  rank: 195,
  disabled: false,
  flags: [],
  scrapeMovie: comboScraper,
  scrapeShow: comboScraper,
});
