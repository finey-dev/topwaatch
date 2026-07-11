import { flags } from '@/entrypoint/utils/targets';
import { SourcererOutput, makeSourcerer } from '@/providers/base';
import { MovieScrapeContext, ShowScrapeContext } from '@/utils/context';

const BASE_URL = 'https://peachify.pro';

async function comboScraper(ctx: ShowScrapeContext | MovieScrapeContext): Promise<SourcererOutput> {
  ctx.progress(30);

  const id = ctx.media.tmdbId;

  let embedUrl: string;
  if (ctx.media.type === 'movie') {
    embedUrl = `${BASE_URL}/embed/movie/${id}`;
  } else {
    embedUrl = `${BASE_URL}/embed/tv/${id}/${ctx.media.season.number}/${ctx.media.episode.number}`;
  }

  const params = new URLSearchParams({
    quality: '1080',
    autoPlay: 'true',
    sub: 'English',
  });

  ctx.progress(90);

  return {
    embeds: [],
    stream: [
      {
        id: 'primary',
        type: 'iframe',
        embedUrl: `${embedUrl}?${params.toString()}`,
        flags: [flags.CORS_ALLOWED],
        captions: [],
      },
    ],
  };
}

export const peachifyScraper = makeSourcerer({
  id: 'peachify',
  name: 'Peachify',
  rank: 185,
  disabled: false,
  flags: [flags.CORS_ALLOWED],
  scrapeMovie: comboScraper,
  scrapeShow: comboScraper,
});
