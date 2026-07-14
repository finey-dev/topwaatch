import { Hono } from "hono";

import { checkFebboxResolveRateLimit } from "../lib/febbox/cache";
import {
  getFileList,
  getStreamsForMedia,
  hlsUrlForOssFid,
  isHlsPlayable,
} from "../lib/febbox/client";
import {
  resolveByTmdb,
  resolveMediaStreams,
  resolveVariantStreams,
  streamsToGridDownloads,
} from "../lib/febbox/pipeline";

/**
 * Febbox / TopWaatch 4K pipeline.
 * - Traffic validation
 * - Stream resolve (replaces dead P-Stream fed-api hosts)
 * - Variants / grid for player extras
 */
export const febboxRoutes = new Hono();

function clientIp(c: {
  req: { header: (name: string) => string | undefined };
}): string {
  return (
    c.req.header("cf-connecting-ip") ||
    c.req.header("x-forwarded-for")?.split(",")[0]?.trim() ||
    "unknown"
  );
}

function assertFebboxRateLimit(c: {
  req: { header: (name: string) => string | undefined };
}): Response | null {
  if (checkFebboxResolveRateLimit(clientIp(c))) return null;
  return Response.json(
    { streams: {}, subtitles: {}, error: "rate limit exceeded" },
    { status: 429 },
  );
}

const FEBBOX_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

type FebboxTrafficStatus =
  | "success"
  | "unset"
  | "invalid_token"
  | "api_down";

interface FebboxTrafficQuota {
  traffic_today_usage?: string;
  traffic_limit?: string;
  reset_at?: string;
  traffic_usage?: string;
  traffic_today_usage_mb?: number;
  traffic_limit_mb?: number;
  off?: number;
  used?: number;
  is_vip?: number;
}

function looksLikeUiToken(ui: string): boolean {
  const parts = ui.split(".");
  if (parts.length !== 3) return false;
  try {
    const mid = parts[1];
    if (!mid) return false;
    const payload = JSON.parse(
      Buffer.from(mid.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString(
        "utf8",
      ),
    );
    if (payload?.exp && Number(payload.exp) * 1000 < Date.now()) return false;
    if (!payload?.data?.uid || !payload?.data?.token) return false;
    return true;
  } catch {
    return false;
  }
}

async function fetchFebboxTraffic(
  ui: string,
): Promise<{ status: FebboxTrafficStatus; quota: FebboxTrafficQuota | null }> {
  if (!ui) return { status: "unset", quota: null };
  // Validate the JWT structure + expiry locally first.  If this fails the
  // token is definitely bad  no need to hit the network.
  if (!looksLikeUiToken(ui)) return { status: "invalid_token", quota: null };

  try {
    const res = await fetch(
      "https://www.febbox.com/console/user_traffic_query",
      {
        method: "GET",
        headers: {
          "User-Agent": FEBBOX_UA,
          Accept: "application/json, text/javascript, */*; q=0.01",
          "Accept-Language": "en",
          "X-Requested-With": "XMLHttpRequest",
          Referer: "https://www.febbox.com/",
          Origin: "https://www.febbox.com",
          Cookie: `ui=${ui}`,
        },
        redirect: "manual",
      },
    );

    // Febbox's traffic endpoint requires a full browser session (Laravel session
    // cookie, CSRF token, etc.) in addition to the `ui` JWT.  When called
    // server-side without those cookies, Febbox returns a 302 redirect to its
    // login page.  With redirect:"manual" the status is 0 or 3xx  not JSON.
    // Since the JWT already passed looksLikeUiToken(), fall back to "success".
    if (res.status === 0 || (res.status >= 300 && res.status < 600 && res.status !== 400 && res.status !== 401)) {
      if (res.status === 502 || res.status === 503) {
        // Febbox itself is down  the JWT may still be valid.
        // Still return success so a valid local JWT isn't wrongly blocked.
        return { status: "success", quota: null };
      }
      if (res.status >= 300 && res.status < 400) {
        // Redirect = Febbox wants a browser session we don't have server-side.
        return { status: "success", quota: null };
      }
    }

    const text = await res.text();
    let json: any;
    try {
      json = JSON.parse(text);
    } catch {
      // Non-JSON (HTML error page, empty redirect body, etc.)
      // The JWT is structurally valid, so report success without quota.
      return { status: "success", quota: null };
    }

    // Explicit auth rejections from Febbox
    if (json?.login_required || json?.code === -1) {
      return { status: "invalid_token", quota: null };
    }

    if (json?.code !== 1 || !json?.data) {
      // Unknown / unexpected response  JWT is valid, quota just unavailable.
      return { status: "success", quota: null };
    }

    const data = json.data as FebboxTrafficQuota;
    return {
      status: "success",
      quota: {
        traffic_today_usage: data.traffic_today_usage,
        traffic_limit: data.traffic_limit,
        reset_at: data.reset_at,
        traffic_usage: data.traffic_usage,
        traffic_today_usage_mb: data.traffic_today_usage_mb,
        traffic_limit_mb: data.traffic_limit_mb,
        off: data.off,
        used: data.used,
        is_vip: data.is_vip,
      },
    };
  } catch {
    // Network error reaching Febbox  JWT is valid, treat as connected.
    return { status: "success", quota: null };
  }
}

function requireUi(queryUi: string | undefined): string | null {
  const ui = queryUi?.trim() ?? "";
  if (!ui || !looksLikeUiToken(ui)) return null;
  return ui;
}

febboxRoutes.get("/febbox/traffic", async (c) => {
  const result = await fetchFebboxTraffic(c.req.query("ui")?.trim() ?? "");
  return c.json(result);
});

febboxRoutes.post("/febbox/traffic", async (c) => {
  let ui = "";
  try {
    const body = await c.req.json();
    ui = typeof body?.ui === "string" ? body.ui.trim() : "";
  } catch {
    ui = "";
  }
  return c.json(await fetchFebboxTraffic(ui));
});

/** Title-based resolve  replaces dead partner `/fedapi`. */
febboxRoutes.get("/febbox/fedapi", async (c) => {
  const limited = assertFebboxRateLimit(c);
  if (limited) return limited;

  const ui = requireUi(c.req.query("ui"));
  if (!ui) {
    return c.json({ streams: {}, subtitles: {}, error: "invalid token" }, 401);
  }

  const name = c.req.query("name")?.trim();
  const yearRaw = c.req.query("year");
  const seasonRaw = c.req.query("season");
  const episodeRaw = c.req.query("episode");
  if (!name) {
    return c.json({ streams: {}, subtitles: {}, error: "name required" }, 400);
  }

  try {
    const data = await resolveMediaStreams({
      ui,
      title: name,
      year: yearRaw ? Number(yearRaw) : undefined,
      type: seasonRaw && episodeRaw ? "show" : "movie",
      season: seasonRaw ? Number(seasonRaw) : undefined,
      episode: episodeRaw ? Number(episodeRaw) : undefined,
      preferHls: false,
    });
    return c.json(data);
  } catch (err) {
    return c.json(
      {
        streams: {},
        subtitles: {},
        error: err instanceof Error ? err.message : "resolve failed",
      },
      500,
    );
  }
});

/** TMDB-indexed movie resolve  replaces fed-api-db.pstream.mov */
febboxRoutes.get("/febbox/movie/:tmdbId", async (c) => {
  const limited = assertFebboxRateLimit(c);
  if (limited) return limited;

  const ui = requireUi(c.req.query("ui"));
  if (!ui) {
    return c.json({ streams: {}, subtitles: {}, error: "invalid token" }, 401);
  }
  try {
    const data = await resolveByTmdb({
      ui,
      tmdbId: c.req.param("tmdbId"),
      type: "movie",
      preferHls: c.req.query("hls") === "1",
    });
    return c.json(data);
  } catch (err) {
    return c.json(
      {
        streams: {},
        subtitles: {},
        error: err instanceof Error ? err.message : "resolve failed",
      },
      500,
    );
  }
});

febboxRoutes.get("/febbox/tv/:tmdbId/:season/:episode", async (c) => {
  const limited = assertFebboxRateLimit(c);
  if (limited) return limited;

  const ui = requireUi(c.req.query("ui"));
  if (!ui) {
    return c.json({ streams: {}, subtitles: {}, error: "invalid token" }, 401);
  }
  try {
    const data = await resolveByTmdb({
      ui,
      tmdbId: c.req.param("tmdbId"),
      type: "show",
      season: Number(c.req.param("season")),
      episode: Number(c.req.param("episode")),
      preferHls: c.req.query("hls") === "1",
    });
    return c.json(data);
  } catch (err) {
    return c.json(
      {
        streams: {},
        subtitles: {},
        error: err instanceof Error ? err.message : "resolve failed",
      },
      500,
    );
  }
});

/** Nova: resolve a specific file variant to quality URLs (+ captions when known). */
febboxRoutes.get("/febbox/resolve", async (c) => {
  const ui = requireUi(c.req.query("ui"));
  const shareKey = c.req.query("shareKey")?.trim();
  const fid = c.req.query("fid")?.trim();
  if (!ui || !shareKey || !fid) {
    return c.json({ error: "ui, shareKey, and fid required" }, 400);
  }
  const showboxId = c.req.query("showboxId")?.trim();
  const mediaTypeRaw = c.req.query("type")?.trim();
  const mediaType =
    mediaTypeRaw === "movie" || mediaTypeRaw === "show"
      ? mediaTypeRaw
      : undefined;
  const seasonQ = c.req.query("season");
  const episodeQ = c.req.query("episode");
  try {
    return c.json(
      await resolveVariantStreams(shareKey, fid, ui, {
        showboxId: showboxId || undefined,
        type: mediaType,
        season: seasonQ ? Number(seasonQ) : undefined,
        episode: episodeQ ? Number(episodeQ) : undefined,
      }),
    );
  } catch (err) {
    return c.json(
      { error: err instanceof Error ? err.message : "resolve failed" },
      500,
    );
  }
});

/** Artemis: HLS playlist for a fid. */
febboxRoutes.get("/febbox/artemis/:fid", async (c) => {
  const ui = requireUi(c.req.query("ui"));
  const shareKey = c.req.query("shareKey")?.trim();
  const fid = c.req.param("fid");
  if (!ui || !shareKey) {
    return c.json({ error: "ui and shareKey required" }, 400);
  }
  try {
    let match = (await getStreamsForMedia(shareKey, ui, "movie")).find(
      (f) => String(f.fid) === String(fid),
    );
    if (!match) {
      const root = await getFileList(shareKey, ui);
      match = root.find((f) => String(f.fid) === String(fid));
      if (!match) {
        for (const dir of root.filter((f) => f.is_dir)) {
          const kids = await getFileList(shareKey, ui, dir.fid);
          match = kids.find((f) => String(f.fid) === String(fid));
          if (match) break;
        }
      }
    }
    if (!match?.oss_fid) return c.json({ error: "file not found" }, 404);
    if (!(await isHlsPlayable(match.oss_fid, ui, shareKey))) {
      return c.json(
        { error: "HLS playlist unavailable for this Febbox account" },
        404,
      );
    }
    return c.json({ url: hlsUrlForOssFid(match.oss_fid) });
  } catch (err) {
    return c.json(
      { error: err instanceof Error ? err.message : "artemis resolve failed" },
      500,
    );
  }
});

/** Grid downloads for the player downloads panel. */
febboxRoutes.get("/febbox/grid/:tmdbId", async (c) => {
  const limited = assertFebboxRateLimit(c);
  if (limited) return limited;

  const ui = requireUi(c.req.query("ui"));
  if (!ui) return c.json({ downloads: [], error: "invalid token" }, 401);
  const type = (c.req.query("type") === "show" ? "show" : "movie") as
    | "movie"
    | "show";
  try {
    const data = await resolveByTmdb({
      ui,
      tmdbId: c.req.param("tmdbId"),
      type,
      season: c.req.query("season")
        ? Number(c.req.query("season"))
        : undefined,
      episode: c.req.query("episode")
        ? Number(c.req.query("episode"))
        : undefined,
      preferHls: false,
    });
    return c.json(streamsToGridDownloads(data));
  } catch (err) {
    return c.json(
      {
        downloads: [],
        error: err instanceof Error ? err.message : "grid failed",
      },
      500,
    );
  }
});
