import type { RunOutput, ScrapeMedia } from "@topwaatch/providers";

import { conf } from "@/setup/config";
import { AccountWithToken } from "@/stores/auth";

export type ScrapeSseEvent =
  | { event: "init"; data: { sourceIds: string[] } }
  | {
      event: "source";
      data: {
        id: string;
        status: string;
        percentage?: number;
        reason?: string;
      };
    }
  | {
      event: "discoverEmbeds";
      data: {
        sourceId: string;
        embeds: { id: string; embedScraperId: string }[];
      };
    }
  | {
      event: "done";
      data:
        | RunOutput
        | {
            resultId?: string;
            ok?: boolean;
            sourceId?: string;
            stream: null;
            error?: string;
          };
    }
  | { event: "error"; data: { error: string } };

function getBackendUrl(): string {
  const config = conf();
  const url =
    config.BACKEND_URLS.length > 0
      ? config.BACKEND_URLS[0]
      : config.BACKEND_URL;
  if (!url) throw new Error("Backend URL is not configured");
  return url.replace(/\/$/, "");
}

function authHeaders(
  account: AccountWithToken | null,
  accept: string,
): HeadersInit {
  const headers: Record<string, string> = {
    Accept: accept,
  };
  if (account?.token) {
    headers.Authorization = `Bearer ${account.token}`;
  }
  return headers;
}

function mediaToQuery(
  media: ScrapeMedia,
  extras?: {
    sourceOrder?: string[];
    embedOrder?: string[];
    excludeSourceIds?: string[];
    skipHevcFileStreams?: boolean;
  },
): URLSearchParams {
  const params = new URLSearchParams({
    type: media.type,
    tmdbId: media.tmdbId,
    title: media.title,
    releaseYear: String(media.releaseYear),
  });
  if (media.imdbId) params.set("imdbId", media.imdbId);
  if (media.type === "show") {
    params.set("seasonId", media.season.tmdbId);
    params.set("episodeId", media.episode.tmdbId);
    params.set("seasonNumber", String(media.season.number));
    params.set("episodeNumber", String(media.episode.number));
    params.set("seasonTitle", media.season.title);
  }
  if (extras?.sourceOrder?.length) {
    params.set("sourceOrder", extras.sourceOrder.join(","));
  }
  if (extras?.embedOrder?.length) {
    params.set("embedOrder", extras.embedOrder.join(","));
  }
  if (extras?.excludeSourceIds?.length) {
    params.set("excludeSourceIds", extras.excludeSourceIds.join(","));
  }
  if (extras?.skipHevcFileStreams) {
    params.set("skipHevcFileStreams", "true");
  }
  return params;
}

function mediaToScrapeInput(
  media: ScrapeMedia,
  extras?: {
    sourceOrder?: string[];
    embedOrder?: string[];
    excludeSourceIds?: string[];
    skipHevcFileStreams?: boolean;
  },
): Record<string, unknown> {
  const body: Record<string, unknown> = {
    type: media.type,
    tmdbId: media.tmdbId,
    title: media.title,
    releaseYear: media.releaseYear,
    imdbId: media.imdbId,
    sourceOrder: extras?.sourceOrder,
    embedOrder: extras?.embedOrder,
    excludeSourceIds: extras?.excludeSourceIds,
    skipHevcFileStreams: extras?.skipHevcFileStreams,
  };
  if (media.type === "show") {
    body.seasonId = media.season.tmdbId;
    body.episodeId = media.episode.tmdbId;
    body.seasonNumber = media.season.number;
    body.episodeNumber = media.episode.number;
    body.seasonTitle = media.season.title;
  }
  return body;
}

function unwrapTrpcData<T>(body: unknown): T {
  const b = body as { result?: { data?: { json?: T } | T }; error?: unknown };
  if (b?.error) {
    const err = b.error as { message?: string; json?: { message?: string } };
    throw new Error(err.json?.message || err.message || "tRPC error");
  }
  const data = b?.result?.data;
  if (data && typeof data === "object" && data !== null && "json" in data) {
    return (data as { json: T }).json;
  }
  return data as T;
}

export interface ServerScrapeOptions {
  media: ScrapeMedia;
  sourceOrder?: string[];
  embedOrder?: string[];
  excludeSourceIds?: string[];
  skipHevcFileStreams?: boolean;
  account?: AccountWithToken | null;
  signal?: AbortSignal;
  onEvent?: (evt: ScrapeSseEvent) => void;
}

/**
 * Run a scrape on the server via SSE (progress + compact done).
 * Falls back to JSON GET, then tRPC, if the stream is truncated or the
 * backend reloads mid-request (Chrome: net::ERR_INCOMPLETE_CHUNKED_ENCODING).
 */
export async function runServerScrape(
  ops: ServerScrapeOptions,
): Promise<RunOutput | null> {
  try {
    return await runServerScrapeSse(ops);
  } catch (err) {
    if (ops.signal?.aborted) throw err;
    // Don't multiply rate-limit hits with JSON/tRPC retries.
    const message = err instanceof Error ? err.message : String(err);
    if (/\b429\b|rate limit/i.test(message)) throw err;
    try {
      return await runServerScrapeJson(ops);
    } catch (jsonErr) {
      const jsonMessage =
        jsonErr instanceof Error ? jsonErr.message : String(jsonErr);
      if (/\b429\b|rate limit/i.test(jsonMessage)) throw jsonErr;
      return runServerScrapeTrpc(ops);
    }
  }
}

async function fetchScrapeResult(
  backendUrl: string,
  resultId: string,
  account: AccountWithToken | null,
  signal?: AbortSignal,
): Promise<RunOutput | null> {
  const response = await fetch(`${backendUrl}/scrape/result/${resultId}`, {
    method: "GET",
    headers: authHeaders(account, "application/json"),
    credentials: "include",
    signal,
  });
  if (response.status === 404) {
    const body = (await response.json().catch(() => null)) as {
      stream?: null;
      error?: string;
    } | null;
    if (body && body.stream === null) return null;
    throw new Error("Scrape result expired");
  }
  if (!response.ok) {
    throw new Error(`Scrape result failed: ${response.status}`);
  }
  const json = (await response.json()) as RunOutput & { error?: string };
  if (!json?.stream) return null;
  return json;
}

async function runServerScrapeSse(
  ops: ServerScrapeOptions,
): Promise<RunOutput | null> {
  const backendUrl = getBackendUrl();
  const params = mediaToQuery(ops.media, ops);
  const url = `${backendUrl}/scrape/run?${params.toString()}`;

  const response = await fetch(url, {
    method: "GET",
    headers: authHeaders(ops.account ?? null, "text/event-stream"),
    credentials: "include",
    signal: ops.signal,
  });

  if (!response.ok) {
    throw new Error(`Scrape failed: ${response.status}`);
  }

  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.includes("text/event-stream") && response.body) {
    return consumeSse(response.body, backendUrl, ops);
  }

  const json = (await response.json()) as RunOutput & { error?: string };
  if (!json?.stream) return null;
  ops.onEvent?.({ event: "done", data: json });
  return json;
}

async function runServerScrapeJson(
  ops: ServerScrapeOptions,
): Promise<RunOutput | null> {
  const backendUrl = getBackendUrl();
  const params = mediaToQuery(ops.media, ops);
  const url = `${backendUrl}/scrape/run?${params.toString()}`;

  const response = await fetch(url, {
    method: "GET",
    headers: authHeaders(ops.account ?? null, "application/json"),
    credentials: "include",
    signal: ops.signal,
  });

  if (!response.ok) {
    if (response.status === 404) {
      const body = (await response.json().catch(() => null)) as {
        stream?: null;
      } | null;
      if (body && body.stream === null) return null;
    }
    throw new Error(`Scrape failed: ${response.status}`);
  }

  const json = (await response.json()) as RunOutput & { error?: string };
  if (!json?.stream) return null;
  ops.onEvent?.({ event: "done", data: json });
  return json;
}

async function runServerScrapeTrpc(
  ops: ServerScrapeOptions,
): Promise<RunOutput | null> {
  const backendUrl = getBackendUrl();
  const input = mediaToScrapeInput(ops.media, ops);

  const response = await fetch(`${backendUrl}/trpc/scrape.run`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(ops.account?.token
        ? { Authorization: `Bearer ${ops.account.token}` }
        : {}),
    },
    credentials: "include",
    body: JSON.stringify(input),
    signal: ops.signal,
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    const message =
      (err as { error?: { json?: { message?: string }; message?: string } })
        .error?.json?.message ||
      (err as { error?: { message?: string } }).error?.message ||
      `Scrape failed: ${response.status}`;
    throw new Error(message);
  }

  const body = await response.json();
  const result = unwrapTrpcData<{
    ok: boolean;
    stream?: RunOutput["stream"] | null;
  } & Partial<RunOutput>>(body);

  if (!result?.ok || !result.stream) return null;

  const { ok: _ok, ...output } = result as { ok: true } & RunOutput;
  ops.onEvent?.({ event: "done", data: output });
  return output;
}

async function consumeSse(
  body: ReadableStream<Uint8Array>,
  backendUrl: string,
  ops: ServerScrapeOptions,
): Promise<RunOutput | null> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let result: RunOutput | null = null;
  let resultId: string | null = null;
  let sawTerminal = false;
  let currentEvent = "message";

  const handleData = async (raw: string) => {
    const data = JSON.parse(raw);
    const evt = { event: currentEvent, data } as ScrapeSseEvent;
    ops.onEvent?.(evt);

    if (currentEvent === "done") {
      sawTerminal = true;
      if (typeof data?.resultId === "string") {
        resultId = data.resultId;
      } else if (data?.stream) {
        result = data as RunOutput;
      } else {
        result = null;
      }
    }
    if (currentEvent === "error") {
      throw new Error(data?.error || "Scrape failed");
    }
  };

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      const parts = buffer.split("\n");
      buffer = parts.pop() ?? "";

      for (const line of parts) {
        if (line.startsWith("event:")) {
          currentEvent = line.slice(6).trim();
        } else if (line.startsWith("data:")) {
          const raw = line.slice(5).trim();
          if (!raw) continue;
          try {
            await handleData(raw);
          } catch (e) {
            if (e instanceof SyntaxError) continue;
            throw e;
          }
        } else if (line === "") {
          currentEvent = "message";
        }
      }
    }
  } catch (err) {
    // Connection dropped after a terminal event  still usable.
    if (!sawTerminal && !resultId && !result) throw err;
  }

  if (resultId) {
    const fetched = await fetchScrapeResult(
      backendUrl,
      resultId,
      ops.account ?? null,
      ops.signal,
    );
    if (fetched) {
      ops.onEvent?.({ event: "done", data: fetched });
    }
    return fetched;
  }

  return result;
}
