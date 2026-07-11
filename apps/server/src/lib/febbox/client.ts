/**
 * Direct Febbox web API helpers (cookie: ui=<token>).
 */
const FEBBOX_BASE = "https://www.febbox.com";
const FEBBOX_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

export type FebboxFile = {
  file_name: string;
  ext: string;
  fid: number;
  oss_fid: number;
  is_dir: 0 | 1;
  size?: string | number;
};

export type FebboxQualityLink = {
  url: string;
  quality: string;
  name?: string;
  size?: string;
};

function headers(ui: string, shareKey?: string): Record<string, string> {
  const h: Record<string, string> = {
    "User-Agent": FEBBOX_UA,
    Accept: "application/json, text/javascript, */*; q=0.01",
    "X-Requested-With": "XMLHttpRequest",
    Origin: FEBBOX_BASE,
    Cookie: `ui=${ui}`,
  };
  if (shareKey) {
    h.Referer = `${FEBBOX_BASE}/share/${shareKey}`;
  } else {
    h.Referer = `${FEBBOX_BASE}/`;
  }
  return h;
}

export async function getFileList(
  shareKey: string,
  ui: string,
  parentId = 0,
): Promise<FebboxFile[]> {
  const url = new URL(`${FEBBOX_BASE}/file/file_share_list`);
  url.searchParams.set("share_key", shareKey);
  url.searchParams.set("pwd", "");
  url.searchParams.set("parent_id", String(parentId));
  url.searchParams.set("is_html", "0");
  if (parentId) url.searchParams.set("page", "1");

  const res = await fetch(url.toString(), { headers: headers(ui, shareKey) });
  if (!res.ok) throw new Error(`Febbox file list failed (${res.status})`);
  const json = (await res.json()) as {
    data?: { file_list?: FebboxFile[] };
    code?: number;
  };
  return json?.data?.file_list ?? [];
}

/** Parse video_quality_list HTML for data-url / data-quality attributes. */
export function parseQualityHtml(html: string): FebboxQualityLink[] {
  const out: FebboxQualityLink[] = [];
  const blockRe =
    /<[^>]*class="[^"]*file_quality[^"]*"[^>]*>/gi;
  const blocks = html.match(blockRe) ?? [];

  for (const tag of blocks) {
    const url = tag.match(/data-url="([^"]+)"/i)?.[1];
    const quality = tag.match(/data-quality="([^"]+)"/i)?.[1];
    if (!url || !quality) continue;
    out.push({ url, quality });
  }

  // Fallback: looser attribute order
  if (out.length === 0) {
    const looseRe =
      /data-url="([^"]+)"[^>]*data-quality="([^"]+)"|data-quality="([^"]+)"[^>]*data-url="([^"]+)"/gi;
    let m: RegExpExecArray | null;
    while ((m = looseRe.exec(html)) !== null) {
      const url = m[1] || m[4];
      const quality = m[2] || m[3];
      if (url && quality) out.push({ url, quality });
    }
  }

  return out;
}

export async function getQualityLinks(
  shareKey: string,
  fid: number,
  ui: string,
): Promise<FebboxQualityLink[]> {
  const url = `${FEBBOX_BASE}/console/video_quality_list?fid=${fid}`;
  const res = await fetch(url, { headers: headers(ui, shareKey) });
  if (!res.ok) throw new Error(`Febbox qualities failed (${res.status})`);
  const json = (await res.json()) as { html?: string; code?: number };
  if (!json?.html) return [];
  return parseQualityHtml(json.html);
}

export function hlsUrlForOssFid(ossFid: number | string): string {
  return `${FEBBOX_BASE}/hls/main/${ossFid}.m3u8`;
}

/** Headers the player/proxy must send when fetching Febbox HLS playlists/segments. */
export function febboxStreamHeaders(ui: string, shareKey?: string): Record<string, string> {
  return {
    Cookie: `ui=${ui}`,
    Referer: shareKey
      ? `${FEBBOX_BASE}/share/${shareKey}`
      : `${FEBBOX_BASE}/`,
    Origin: FEBBOX_BASE,
    "User-Agent": FEBBOX_UA,
  };
}

/**
 * Probe whether `/hls/main/{ossFid}.m3u8` returns a real playlist for this account.
 * Without a valid ui cookie Febbox returns empty HTML with status 200.
 */
export async function isHlsPlayable(
  ossFid: number | string,
  ui: string,
  shareKey?: string,
): Promise<boolean> {
  try {
    const res = await fetch(hlsUrlForOssFid(ossFid), {
      headers: {
        ...headers(ui, shareKey),
        Accept: "application/vnd.apple.mpegurl, application/x-mpegURL, */*",
      },
    });
    if (!res.ok) return false;
    const text = await res.text();
    return text.includes("#EXTM3U");
  } catch {
    return false;
  }
}

export function isVideoFile(file: FebboxFile): boolean {
  if (file.is_dir) return false;
  const ext = (file.ext || "").toLowerCase();
  return ext === "mp4" || ext === "mkv" || ext === "m3u8" || ext === "ts";
}

export async function getStreamsForMedia(
  shareKey: string,
  ui: string,
  type: "movie" | "show",
  season?: number,
  episode?: number,
): Promise<FebboxFile[]> {
  const root = await getFileList(shareKey, ui);

  if (type === "show") {
    const seasonFolder = root.find((f) => {
      if (!f.is_dir) return false;
      return f.file_name.toLowerCase() === `season ${season}`;
    });
    if (!seasonFolder) return [];

    const episodes = await getFileList(shareKey, ui, seasonFolder.fid);
    const s = String(season ?? 0);
    const e = String(episode ?? 0);
    const episodeRegex = new RegExp(`[Ss]0*${s}[Ee]0*${e}`);
    return episodes.filter((file) => {
      if (!isVideoFile(file)) return false;
      return episodeRegex.test(file.file_name);
    });
  }

  return root.filter(isVideoFile);
}
