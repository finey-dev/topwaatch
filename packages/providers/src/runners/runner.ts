import { FullScraperEvents, UpdateEvent } from '@/entrypoint/utils/events';
import { ScrapeMedia } from '@/entrypoint/utils/media';
import { FeatureMap, flagsAllowedInFeatures } from '@/entrypoint/utils/targets';
import { UseableFetcher } from '@/fetchers/types';
import { EmbedOutput, SourcererOutput } from '@/providers/base';
import { ProviderList } from '@/providers/get';
import { Stream } from '@/providers/streams';
import { ScrapeContext } from '@/utils/context';
import { NotFoundError } from '@/utils/errors';
import { reorderOnIdList } from '@/utils/list';
import { requiresProxy, setupProxy } from '@/utils/proxy';
import { isValidStream, validatePlayableStream } from '@/utils/valid';

export type RunOutput = {
  sourceId: string;
  embedId?: string;
  stream: Stream;
};

export type SourceRunOutput = {
  sourceId: string;
  stream: Stream[];
  embeds: [];
};

export type EmbedRunOutput = {
  embedId: string;
  stream: Stream[];
};

export type ProviderRunnerOptions = {
  fetcher: UseableFetcher;
  proxiedFetcher: UseableFetcher;
  features: FeatureMap;
  sourceOrder?: string[];
  embedOrder?: string[];
  /** Source ids to never try (e.g. client already marked them failed). */
  excludeSourceIds?: string[];
  /**
   * When true, file streams whose every quality URL looks like HEVC/H.265
   * are treated as not found so the runner continues to the next source.
   * Used by browsers that cannot decode HEVC in <video>.
   */
  skipHevcFileStreams?: boolean;
  events?: FullScraperEvents;
  media: ScrapeMedia;
  proxyStreams?: boolean; // temporary
};

function isLikelyHevcUrl(url: string): boolean {
  let decoded = url;
  try {
    decoded = decodeURIComponent(url);
  } catch {
    // keep original
  }
  return /(?:^|[/\-_.])(?:h265|hevc|x265|hev1|hvc1)(?:[/\-_.?]|$)/i.test(decoded);
}

function isHevcOnlyFileStream(stream: Stream): boolean {
  if (stream.type !== 'file') return false;
  const urls = Object.values(stream.qualities)
    .map((q) => q?.url)
    .filter((url): url is string => Boolean(url?.length));
  if (urls.length === 0) return false;
  return urls.every((url) => isLikelyHevcUrl(url));
}

export async function runAllProviders(list: ProviderList, ops: ProviderRunnerOptions): Promise<RunOutput | null> {
  const excluded = new Set(ops.excludeSourceIds ?? []);
  const sources = reorderOnIdList(ops.sourceOrder ?? [], list.sources).filter((source) => {
    if (excluded.has(source.id)) return false;
    if (ops.media.type === 'movie') return !!source.scrapeMovie;
    if (ops.media.type === 'show') return !!source.scrapeShow;
    return false;
  });
  const embeds = reorderOnIdList(ops.embedOrder ?? [], list.embeds);
  const embedIds = embeds.map((embed) => embed.id);
  let lastId = '';

  const contextBase: ScrapeContext = {
    fetcher: ops.fetcher,
    proxiedFetcher: ops.proxiedFetcher,
    features: ops.features,
    progress(val) {
      ops.events?.update?.({
        id: lastId,
        percentage: val,
        status: 'pending',
      });
    },
  };

  ops.events?.init?.({
    sourceIds: sources.map((v) => v.id),
  });

  for (const source of sources) {
    ops.events?.start?.(source.id);
    lastId = source.id;

    // run source scrapers
    let output: SourcererOutput | null = null;
    try {
      if (ops.media.type === 'movie' && source.scrapeMovie)
        output = await source.scrapeMovie({
          ...contextBase,
          media: ops.media,
        });
      else if (ops.media.type === 'show' && source.scrapeShow)
        output = await source.scrapeShow({
          ...contextBase,
          media: ops.media,
        });
      if (output) {
        output.stream = (output.stream ?? [])
          .filter(isValidStream)
          .filter((stream) => flagsAllowedInFeatures(ops.features, stream.flags));

        output.stream = output.stream.map((stream) =>
          requiresProxy(stream) && ops.proxyStreams ? setupProxy(stream) : stream,
        );
      }
      if (!output || (!output.stream?.length && !output.embeds.length)) {
        throw new NotFoundError('No streams found');
      }
    } catch (error) {
      const updateParams: UpdateEvent = {
        id: source.id,
        percentage: 100,
        status: error instanceof NotFoundError ? 'notfound' : 'failure',
        reason: error instanceof NotFoundError ? error.message : undefined,
        error: error instanceof NotFoundError ? undefined : error,
      };

      ops.events?.update?.(updateParams);
      continue;
    }
    if (!output) throw new Error('Invalid media type');

    // return stream if there are any
    if (output.stream?.length) {
      for (const candidate of output.stream) {
        try {
          const playableStream = await validatePlayableStream(candidate, ops, source.id);
          if (!playableStream) continue;
          if (ops.skipHevcFileStreams && isHevcOnlyFileStream(playableStream)) {
            continue;
          }

          return {
            sourceId: source.id,
            stream: playableStream,
          };
        } catch {
          continue;
        }
      }

      const updateParams: UpdateEvent = {
        id: source.id,
        percentage: 100,
        status: 'notfound',
        reason: 'No playable stream found',
      };
      ops.events?.update?.(updateParams);
    }

    // filter disabled and run embed scrapers on listed embeds
    const sortedEmbeds = output.embeds
      .filter((embed) => {
        const e = list.embeds.find((v) => v.id === embed.embedId);
        return e && !e.disabled;
      })
      .sort((a, b) => embedIds.indexOf(a.embedId) - embedIds.indexOf(b.embedId));

    if (sortedEmbeds.length > 0) {
      ops.events?.discoverEmbeds?.({
        embeds: sortedEmbeds.map((embed, i) => ({
          id: [source.id, i].join('-'),
          embedScraperId: embed.embedId,
        })),
        sourceId: source.id,
      });
    }

    for (const [ind, embed] of sortedEmbeds.entries()) {
      const scraper = embeds.find((v) => v.id === embed.embedId);
      if (!scraper) throw new Error('Invalid embed returned');

      // run embed scraper
      const id = [source.id, ind].join('-');
      ops.events?.start?.(id);
      lastId = id;

      let embedOutput: EmbedOutput;
      try {
        embedOutput = await scraper.scrape({
          ...contextBase,
          url: embed.url,
        });
        embedOutput.stream = embedOutput.stream
          .filter(isValidStream)
          .filter((stream) => flagsAllowedInFeatures(ops.features, stream.flags));
        embedOutput.stream = embedOutput.stream.map((stream) =>
          requiresProxy(stream) && ops.proxyStreams ? setupProxy(stream) : stream,
        );
        if (embedOutput.stream.length === 0) {
          throw new NotFoundError('No streams found');
        }
        const playableStream = await validatePlayableStream(embedOutput.stream[0], ops, embed.embedId);
        if (!playableStream) throw new NotFoundError('No streams found');
        if (ops.skipHevcFileStreams && isHevcOnlyFileStream(playableStream)) {
          throw new NotFoundError('HEVC-only stream skipped (browser cannot decode H.265)');
        }

        embedOutput.stream = [playableStream];
      } catch (error) {
        const updateParams: UpdateEvent = {
          id,
          percentage: 100,
          status: error instanceof NotFoundError ? 'notfound' : 'failure',
          reason: error instanceof NotFoundError ? error.message : undefined,
          error: error instanceof NotFoundError ? undefined : error,
        };

        ops.events?.update?.(updateParams);
        continue;
      }

      return {
        sourceId: source.id,
        embedId: scraper.id,
        stream: embedOutput.stream[0],
      };
    }
  }

  // no providers or embeds returns streams
  return null;
}
