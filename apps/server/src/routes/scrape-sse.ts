import { auth } from "@topwaatch/auth";
import {
  assertRateLimit,
  rateLimitKey,
  runScrapeForUser,
  scrapeInputSchema,
  storeScrapeResult,
  takeScrapeResult,
  type ScrapeInput,
} from "@topwaatch/api";
import { Hono } from "hono";
import { streamSSE } from "hono/streaming";

/**
 * Thin SSE endpoint for EventSource progress during scrape.
 * Business logic lives in `@topwaatch/api` (`runScrapeForUser`).
 *
 * The final stream payload is large (proxied caption URLs). Sending it inline
 * in the SSE `done` event can trigger Chrome's
 * `net::ERR_INCOMPLETE_CHUNKED_ENCODING`. Instead we cache the result and send
 * a compact `{ resultId }` that the client fetches via GET /scrape/result/:id.
 */
export const scrapeSseRoutes = new Hono();

function clientIpFromHeaders(c: {
  req: { header: (name: string) => string | undefined };
}): string {
  return (
    c.req.header("cf-connecting-ip") ||
    c.req.header("x-forwarded-for")?.split(",")[0]?.trim() ||
    "unknown"
  );
}

async function resolveUserId(headers: Headers): Promise<string | null> {
  const session = await auth.api.getSession({ headers });
  return session?.user?.id ?? null;
}

function parseCsvQuery(value: string | undefined): string[] | undefined {
  if (!value?.trim()) return undefined;
  const items = value
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return items.length > 0 ? items : undefined;
}

function parseQueryInput(c: {
  req: { query: (k: string) => string | undefined };
}): ScrapeInput {
  return scrapeInputSchema.parse({
    type: c.req.query("type"),
    tmdbId: c.req.query("tmdbId"),
    title: c.req.query("title"),
    releaseYear: c.req.query("releaseYear"),
    seasonId: c.req.query("seasonId"),
    episodeId: c.req.query("episodeId"),
    seasonNumber: c.req.query("seasonNumber"),
    episodeNumber: c.req.query("episodeNumber"),
    seasonTitle: c.req.query("seasonTitle"),
    imdbId: c.req.query("imdbId"),
    sourceOrder: parseCsvQuery(c.req.query("sourceOrder")),
    embedOrder: parseCsvQuery(c.req.query("embedOrder")),
    excludeSourceIds: parseCsvQuery(c.req.query("excludeSourceIds")),
    skipHevcFileStreams: c.req.query("skipHevcFileStreams"),
    febboxKey: c.req.query("febboxKey") || undefined,
  });
}

scrapeSseRoutes.get("/scrape/result/:id", async (c) => {
  const id = c.req.param("id");
  const result = takeScrapeResult(id);
  if (!result) {
    return c.json({ error: "Result expired or not found" }, 404);
  }
  if (!result.ok) {
    const { ok: _ok, ...payload } = result;
    return c.json(payload, 404);
  }
  const { ok: _ok, ...output } = result;
  return c.json(output);
});

scrapeSseRoutes.get("/scrape/run", async (c) => {
  const clientIp = clientIpFromHeaders(c);
  const userId = await resolveUserId(c.req.raw.headers);

  try {
    assertRateLimit(rateLimitKey(userId, clientIp));
  } catch {
    return c.json({ error: "Rate limit exceeded" }, 429);
  }

  const accept = c.req.header("Accept") ?? "";
  const wantsSse = accept.includes("text/event-stream");

  let input: ScrapeInput;
  try {
    input = parseQueryInput(c);
  } catch (err) {
    return c.json(
      { error: err instanceof Error ? err.message : "Invalid query" },
      400,
    );
  }

  if (!wantsSse) {
    try {
      const result = await runScrapeForUser(input, userId);
      if (!result.ok) {
        const { ok: _ok, ...payload } = result;
        return c.json(payload, 404);
      }
      const { ok: _ok, ...output } = result;
      return c.json(output);
    } catch (err) {
      return c.json(
        { error: err instanceof Error ? err.message : "Scrape failed" },
        500,
      );
    }
  }

  return streamSSE(c, async (stream) => {
    const send = async (event: string, data: unknown) => {
      await stream.writeSSE({
        event,
        data: JSON.stringify(data),
      });
    };

    try {
      const result = await runScrapeForUser(input, userId, {
        init: async (evt) => {
          await send("init", evt);
        },
        start: async (id) => {
          await send("source", { id, status: "started" });
        },
        update: async (evt) => {
          await send("source", {
            id: evt.id,
            status: evt.status,
            percentage: evt.percentage,
            reason: evt.reason,
          });
        },
        discoverEmbeds: async (evt) => {
          await send("discoverEmbeds", evt);
        },
      });

      // Compact done event — full payload fetched via /scrape/result/:id
      const resultId = storeScrapeResult(result);
      if (result.ok === false) {
        await send("done", {
          resultId,
          ok: false,
          stream: null,
          error: result.error,
        });
      } else {
        await send("done", {
          resultId,
          ok: true,
          sourceId: result.sourceId,
        });
      }
    } catch (err) {
      await send("error", {
        error: err instanceof Error ? err.message : "Scrape failed",
      });
    }
  });
});
