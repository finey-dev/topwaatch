import { ScrapeMedia } from "@topwaatch/providers";
import { nanoid } from "nanoid";
import { ofetch } from "ofetch";
import { useCallback } from "react";

import { ScrapingItems, ScrapingSegment } from "@/hooks/useProviderScrape";
import { conf } from "@/setup/config";
import { useAuthStore } from "@/stores/auth";
import { PlayerMeta } from "@/stores/player/slices/source";

// Anonymous provider health metrics  posted to the TopWaatch backend.
function getMetricsBackendUrl(): string | null {
  const config = conf();
  return config.BACKEND_URLS.length > 0
    ? config.BACKEND_URLS[0]
    : config.BACKEND_URL;
}

function getMetricsEndpoint(path: string): string | null {
  const backendUrl = getMetricsBackendUrl();
  return backendUrl ? `${backendUrl}${path}` : null;
}

const metricsEndpoint = getMetricsEndpoint("/metrics/providers");
const captchaMetricsEndpoint = getMetricsEndpoint("/metrics/captcha");
const batchId = () => nanoid(32);

export type ProviderMetric = {
  tmdbId: string;
  type: string;
  title: string;
  seasonId?: string;
  episodeId?: string;
  status: "failed" | "notfound" | "success";
  providerId: string;
  embedId?: string;
  errorMessage?: string;
  fullError?: string;
};

export type ScrapeTool = "default" | "custom-proxy" | "server";

export function getScrapeTool(): ScrapeTool {
  const hasProxySet = !!useAuthStore.getState().proxySet;
  if (hasProxySet) return "custom-proxy";
  return "server";
}

function getStackTrace(error: Error, lines: number) {
  const topMessage = error.toString();
  const stackTraceLines = (error.stack ?? "").split("\n", lines + 1);
  stackTraceLines.pop();
  return `${topMessage}\n\n${stackTraceLines.join("\n")}`;
}

export async function reportProviders(items: ProviderMetric[]): Promise<void> {
  if (!metricsEndpoint || items.length === 0) return;

  // Server accepts at most 10 items per request  send in chunks.
  const CHUNK_SIZE = 10;
  for (let i = 0; i < items.length; i += CHUNK_SIZE) {
    const chunk = items.slice(i, i + CHUNK_SIZE);
    try {
      await ofetch(metricsEndpoint, {
        method: "POST",
        body: {
          items: chunk,
          tool: getScrapeTool(),
          batchId: batchId(),
        },
      });
    } catch {
      // Best-effort  never break playback on metrics failure.
    }
  }
}

const segmentStatusMap: Record<
  ScrapingSegment["status"],
  ProviderMetric["status"] | null
> = {
  success: "success",
  notfound: "notfound",
  failure: "failed",
  pending: null,
  waiting: null,
};

export function scrapeSourceOutputToProviderMetric(
  media: PlayerMeta,
  providerId: string,
  embedId: string | null,
  status: ProviderMetric["status"],
  err: unknown | null,
): ProviderMetric {
  const episodeId = media.episode?.tmdbId;
  const seasonId = media.season?.tmdbId;
  let error: undefined | Error;
  if (err instanceof Error) error = err;

  return {
    status,
    providerId,
    title: media.title,
    tmdbId: media.tmdbId,
    type: media.type,
    embedId: embedId ?? undefined,
    episodeId,
    seasonId,
    errorMessage: error?.message,
    fullError: error ? getStackTrace(error, 5) : undefined,
  };
}

export function scrapeSegmentToProviderMetric(
  media: ScrapeMedia,
  providerId: string,
  segment: ScrapingSegment,
): ProviderMetric | null {
  const status = segmentStatusMap[segment.status];
  if (!status) return null;
  let episodeId: string | undefined;
  let seasonId: string | undefined;
  if (media.type === "show") {
    episodeId = media.episode.tmdbId;
    seasonId = media.season.tmdbId;
  }
  let error: undefined | Error;
  if (segment.error instanceof Error) error = segment.error;

  return {
    status,
    providerId,
    title: media.title,
    tmdbId: media.tmdbId,
    type: media.type,
    embedId: segment.embedId,
    episodeId,
    seasonId,
    errorMessage: segment.reason ?? error?.message,
    fullError: error ? getStackTrace(error, 5) : undefined,
  };
}

export function scrapePartsToProviderMetric(
  media: ScrapeMedia,
  order: ScrapingItems[],
  sources: Record<string, ScrapingSegment>,
): ProviderMetric[] {
  const output: ProviderMetric[] = [];

  order.forEach((orderItem) => {
    const source = sources[orderItem.id];
    orderItem.children.forEach((embedId) => {
      const embed = sources[embedId];
      if (!embed.embedId) return;
      const metric = scrapeSegmentToProviderMetric(media, source.id, embed);
      if (!metric) return;
      output.push(metric);
    });

    const metric = scrapeSegmentToProviderMetric(media, source.id, source);
    if (!metric) return;
    output.push(metric);
  });

  return output;
}

export function useReportProviders() {
  const report = useCallback((items: ProviderMetric[]) => {
    if (items.length === 0) return;
    reportProviders(items).catch(() => {});
  }, []);

  return { report };
}

export function reportCaptchaSolve(success: boolean) {
  if (!captchaMetricsEndpoint) return;
  ofetch(captchaMetricsEndpoint, {
    method: "POST",
    body: { success },
  }).catch(() => {});
}
