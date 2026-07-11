// TopWaatch Nova / Orbit extras  backed by our Febbox server pipeline.

export type FileVariant = {
  fid: string;
  name: string;
  quality?: string;
  codec?: string;
  size?: string;
  tag?: "bw" | "dv" | "hdr" | "remux";
};

export type ArtemisFileVariant = FileVariant;

export type GridDownloadSource = {
  url: string;
  name: string;
};

export type GridDownload = {
  title: string;
  format?: string;
  resolution?: string;
  size?: string;
  sources: GridDownloadSource[];
};

export type GridData = {
  downloads: GridDownload[];
};

export type VariantMeta = {
  variants: FileVariant[];
  shareKey: string;
} | null;

export type ArtemisVariantMeta = {
  variants: ArtemisFileVariant[];
} | null;

export type ResolveVariantResult = {
  streams: Record<string, { url: string; type: "hls" | "mp4" }>;
  subtitles?: Record<string, { subtitle_link: string }>;
};

const META_KEY = "__TW::febboxMeta";

type StoredMeta = {
  mode: "nova" | "orbit" | "both";
  shareKey: string;
  variants: FileVariant[];
  primaryFid?: string;
  ossFid?: string;
  showboxId?: string;
  mediaType?: "movie" | "show";
  season?: number;
  episode?: number;
};

function readMeta(): StoredMeta | null {
  try {
    if (typeof window === "undefined") return null;
    const raw = window.sessionStorage.getItem(META_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Omit<StoredMeta, "mode"> & {
      mode?: string;
    };
    // Migrate legacy mode names from earlier wiring
    if (parsed.mode === "aurora") parsed.mode = "nova";
    if (parsed.mode === "artemis") parsed.mode = "orbit";
    return parsed as StoredMeta;
  } catch {
    return null;
  }
}

function getUserToken(): string | null {
  try {
    if (typeof window === "undefined") return null;
    const prefData = window.localStorage.getItem("__MW::preferences");
    if (!prefData) return null;
    const parsed = JSON.parse(prefData);
    return parsed?.state?.febboxKey || null;
  } catch {
    return null;
  }
}

export function febboxPlaybackHeaders(ui: string): Record<string, string> {
  return {
    Cookie: `ui=${ui}`,
    Referer: "https://www.febbox.com/",
    Origin: "https://www.febbox.com",
  };
}

function getBackendUrl(): string {
  try {
    if (typeof window !== "undefined") {
      const auth = window.localStorage.getItem("__MW::auth");
      if (auth) {
        const parsed = JSON.parse(auth);
        const url = parsed?.state?.backendUrl;
        if (typeof url === "string" && url.length > 0) {
          return url.replace(/\/$/, "");
        }
      }
    }
  } catch {
    // ignore
  }
  if (typeof window !== "undefined" && window.location.hostname === "localhost") {
    return "http://localhost:3000";
  }
  return "https://api.topwaatch.mov";
}

/** Nova (MP4 / multi-quality) variant meta */
export function getVariantMeta(): VariantMeta {
  const meta = readMeta();
  if (!meta?.shareKey || !meta.variants?.length) return null;
  if (meta.mode === "orbit") return null;
  return { variants: meta.variants, shareKey: meta.shareKey };
}

/** Orbit (HLS) variant meta */
export function getArtemisVariantMeta(): ArtemisVariantMeta {
  const meta = readMeta();
  if (!meta?.variants?.length) return null;
  if (meta.mode === "nova") return null;
  return { variants: meta.variants };
}

export function resolveArtemisVariant(fid: string): { url: string; headers: Record<string, string> } | null {
  const meta = readMeta();
  const token = getUserToken();
  if (!meta?.shareKey || !token) return null;
  if (meta.primaryFid === fid && meta.ossFid) {
    return {
      url: `https://www.febbox.com/hls/main/${meta.ossFid}.m3u8`,
      headers: febboxPlaybackHeaders(token),
    };
  }
  return null;
}

export async function resolveVariant(
  fid: string,
  shareKey: string,
  token: string,
): Promise<ResolveVariantResult | null> {
  try {
    const meta = readMeta();
    const params = new URLSearchParams({
      fid,
      shareKey,
      ui: token,
    });
    if (meta?.showboxId) params.set("showboxId", meta.showboxId);
    if (meta?.mediaType) params.set("type", meta.mediaType);
    if (meta?.season != null) params.set("season", String(meta.season));
    if (meta?.episode != null) params.set("episode", String(meta.episode));

    const url = `${getBackendUrl()}/febbox/resolve?${params.toString()}`;
    const res = await fetch(url, { credentials: "omit" });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      streams?: Record<string, { type: "hls" | "mp4"; url: string } | string>;
      subtitles?: Record<string, { subtitle_link: string }>;
    };
    if (!data.streams) return null;

    const streams: ResolveVariantResult["streams"] = {};
    for (const [q, entry] of Object.entries(data.streams)) {
      const streamUrl = typeof entry === "string" ? entry : entry.url;
      const type = typeof entry === "string" ? "mp4" : entry.type;
      streams[q] = { url: streamUrl, type };
    }
    return { streams, subtitles: data.subtitles };
  } catch {
    return null;
  }
}

export async function resolveArtemisVariantAsync(
  fid: string,
): Promise<{ url: string; headers: Record<string, string> } | null> {
  const meta = readMeta();
  const token = getUserToken();
  if (!meta?.shareKey || !token) return null;
  try {
    const url = `${getBackendUrl()}/febbox/artemis/${encodeURIComponent(fid)}?shareKey=${encodeURIComponent(meta.shareKey)}&ui=${encodeURIComponent(token)}`;
    const res = await fetch(url, { credentials: "omit" });
    if (!res.ok) return null;
    const data = (await res.json()) as { url?: string };
    return data.url
      ? { url: data.url, headers: febboxPlaybackHeaders(token) }
      : null;
  } catch {
    return null;
  }
}

export async function fetchGridData(
  tmdbId: string,
  opts?: {
    type?: "movie" | "show";
    season?: number;
    episode?: number;
  },
): Promise<GridData> {
  const token = getUserToken();
  if (!token) return { downloads: [] };
  try {
    const type = opts?.type === "show" ? "show" : "movie";
    let url = `${getBackendUrl()}/febbox/grid/${encodeURIComponent(tmdbId)}?ui=${encodeURIComponent(token)}&type=${type}`;
    if (opts?.season != null && opts?.episode != null) {
      url += `&season=${opts.season}&episode=${opts.episode}`;
    }
    const res = await fetch(url, { credentials: "omit" });
    if (!res.ok) return { downloads: [] };
    return (await res.json()) as GridData;
  } catch {
    return { downloads: [] };
  }
}
