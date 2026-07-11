/**
 * Showbox / shegu encrypted client API  used to find titles and Febbox share keys.
 * Ported from the archived providers showbox source + show_feb_box_api.
 */
import { createCipheriv, createHash, randomBytes } from "node:crypto";

import { febboxMetaCache, febboxNegativeCache } from "./cache";

const SHOWBOX_API = "https://mbpapi.shegu.net/api/api_client/index/";
const SHOWBOX_WEB = "https://www.showbox.media";
const APP_KEY = "moviebox";
const APP_ID = "com.tdo.showbox";
const KEY = Buffer.from("123d6cedf626dy54233aa1w6", "utf8");
const IV = Buffer.from("wEiphTn!", "utf8");

export type ShowboxSearchItem = {
  id: string | number;
  title: string;
  year?: number;
  box_type?: number; // 1 movie, 2 tv (typical)
};

function encrypt(data: string): string {
  const cipher = createCipheriv("des-ede3-cbc", KEY, IV);
  return Buffer.concat([
    cipher.update(data, "utf8"),
    cipher.final(),
  ]).toString("base64");
}

function getVerify(encryptedData: string): string {
  const appKeyHash = createHash("md5").update(APP_KEY).digest("hex");
  return createHash("md5")
    .update(appKeyHash + "123d6cedf626dy54233aa1w6" + encryptedData)
    .digest("hex");
}

function expiry(): number {
  return Math.floor(Date.now() / 1000 + 60 * 60 * 12);
}

async function showboxRequest(
  module: string,
  params: Record<string, string | number> = {},
): Promise<any> {
  const payload = {
    childmode: "0",
    app_version: "11.5",
    appid: APP_ID,
    lang: "en",
    expired_date: `${expiry()}`,
    platform: "android",
    channel: "Website",
    module,
    ...params,
  };

  const encryptedData = encrypt(JSON.stringify(payload));
  const body = JSON.stringify({
    app_key: createHash("md5").update(APP_KEY).digest("hex"),
    verify: getVerify(encryptedData),
    encrypt_data: encryptedData,
  });

  const form = new URLSearchParams();
  form.set("data", Buffer.from(body, "utf8").toString("base64"));
  form.set("appid", "27");
  form.set("platform", "android");
  form.set("version", "129");
  form.set("medium", "Website");
  form.set("token", randomBytes(16).toString("hex"));

  const res = await fetch(SHOWBOX_API, {
    method: "POST",
    headers: {
      Platform: "android",
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": "okhttp/3.2.0",
    },
    body: form.toString(),
  });

  if (!res.ok) {
    throw new Error(`Showbox API failed (${res.status})`);
  }

  return res.json();
}

function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export async function searchShowbox(
  title: string,
  year?: number,
  preferType?: "movie" | "show",
): Promise<ShowboxSearchItem | null> {
  const cacheKey = `search:${preferType ?? "all"}:${normalizeTitle(title)}:${year ?? ""}`;
  if (febboxNegativeCache.get(cacheKey)) return null;
  const cached = febboxMetaCache.get(cacheKey) as ShowboxSearchItem | null | undefined;
  if (cached !== undefined) return cached;

  const data = await showboxRequest("Search5", {
    page: "1",
    type: "all",
    keyword: title,
    pagelimit: "20",
  });

  // Search5 returns `data` as an array; older modules used `data.list`.
  const raw = data?.data;
  const list: ShowboxSearchItem[] = Array.isArray(raw)
    ? raw
    : (raw?.list ?? data?.list ?? []);
  if (!Array.isArray(list) || list.length === 0) {
    febboxNegativeCache.set(cacheKey, true);
    return null;
  }

  const want = normalizeTitle(title);
  const typed = preferType
    ? list.filter((item) => {
        const box = Number(item.box_type);
        if (preferType === "movie") return box === 1 || Number.isNaN(box);
        return box === 2 || Number.isNaN(box);
      })
    : list;

  const pool = typed.length > 0 ? typed : list;

  const exact = pool.find((item) => {
    const sameTitle = normalizeTitle(String(item.title ?? "")) === want;
    if (!sameTitle) return false;
    if (year == null || !item.year) return true;
    return Number(item.year) === Number(year);
  });
  const byTitle = pool.find(
    (item) => normalizeTitle(String(item.title ?? "")) === want,
  );
  const result = exact ?? byTitle ?? pool[0] ?? null;
  if (!result) {
    febboxNegativeCache.set(cacheKey, true);
    return null;
  }
  febboxMetaCache.set(cacheKey, result);
  return result;
}

/** Resolve Febbox share key for a Showbox media id. type: 1=movie, 2=tv */
export async function getFebboxShareKey(
  showboxId: string | number,
  type: "movie" | "show",
): Promise<string | null> {
  const cacheKey = `share:${type}:${showboxId}`;
  if (febboxNegativeCache.get(cacheKey)) return null;
  const cached = febboxMetaCache.get(cacheKey) as string | null | undefined;
  if (cached !== undefined) return cached;

  const typeNum = type === "movie" ? "1" : "2";
  const url = `${SHOWBOX_WEB}/index/share_link?id=${encodeURIComponent(String(showboxId))}&type=${typeNum}`;
  const res = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      Accept: "application/json",
    },
  });
  if (!res.ok) {
    febboxNegativeCache.set(cacheKey, true);
    return null;
  }
  const json = (await res.json()) as { data?: { link?: string } };
  const link = json?.data?.link;
  if (!link) {
    febboxNegativeCache.set(cacheKey, true);
    return null;
  }
  let key: string | null;
  try {
    const parts = new URL(link).pathname.split("/").filter(Boolean);
    // https://www.febbox.com/share/<key>
    key = parts[parts.length - 1] ?? null;
  } catch {
    key = link.split("/").pop() ?? null;
  }
  if (!key) {
    febboxNegativeCache.set(cacheKey, true);
    return null;
  }
  febboxMetaCache.set(cacheKey, key);
  return key;
}

/** CDN hosts used for Showbox subtitle file URLs. */
const CAPTIONS_DOMAIN_FROM = "mbpimages.chuaxin.com";
const CAPTIONS_DOMAIN_TO = "images.shegu.net";

/** Map Showbox ISO-ish lang codes → keys Nova/Orbit parseCaptions expect. */
const SUBTITLE_LANG_KEYS: Record<string, string> = {
  en: "english",
  eng: "english",
  es: "spanish",
  spa: "spanish",
  fr: "french",
  fre: "french",
  fra: "french",
  de: "german",
  ger: "german",
  deu: "german",
  it: "italian",
  ita: "italian",
  pt: "portuguese",
  por: "portuguese",
  ru: "russian",
  rus: "russian",
  ja: "japanese",
  jpn: "japanese",
  zh: "chinese",
  chi: "chinese",
  zho: "chinese",
  ko: "korean",
  kor: "korean",
  ar: "arabic",
  ara: "arabic",
  hi: "hindi",
  hin: "hindi",
  tr: "turkish",
  tur: "turkish",
  pl: "polish",
  pol: "polish",
  nl: "dutch",
  dut: "dutch",
  nld: "dutch",
  sv: "swedish",
  swe: "swedish",
  no: "norwegian",
  nor: "norwegian",
  da: "danish",
  dan: "danish",
  fi: "finnish",
  fin: "finnish",
  cs: "czech",
  cze: "czech",
  ces: "czech",
  el: "greek",
  gre: "greek",
  ell: "greek",
  he: "hebrew",
  heb: "hebrew",
  th: "thai",
  tha: "thai",
  vi: "vietnamese",
  vie: "vietnamese",
  id: "indonesian",
  ind: "indonesian",
  ms: "malay",
  may: "malay",
  msa: "malay",
  uk: "ukrainian",
  ukr: "ukrainian",
  ro: "romanian",
  rum: "romanian",
  ron: "romanian",
  hu: "hungarian",
  hun: "hungarian",
};

export type ShowboxSubtitleMap = Record<
  string,
  { subtitle_link: string; subtitle_name?: string }
>;

type CaptionApiResponse = {
  data?: {
    list?: Array<{
      subtitles?: Array<{
        order?: number;
        lang?: string;
        file_path?: string;
      }>;
    }>;
  };
};

function rewriteCaptionUrl(filePath: string): string {
  return filePath
    .replace(CAPTIONS_DOMAIN_FROM, CAPTIONS_DOMAIN_TO)
    .replace(/\s/g, "+")
    .replace(/[()]/g, (c) => `%${c.charCodeAt(0).toString(16)}`);
}

function langKeyFor(lang: string): string {
  const raw = lang.trim().toLowerCase();
  if (!raw) return "unknown";
  const base = raw.split(/[-_]/)[0] ?? raw;
  return SUBTITLE_LANG_KEYS[base] ?? SUBTITLE_LANG_KEYS[raw] ?? base;
}

/**
 * Fetch Febbox/Showbox captions for a title (replaces dead fed-subs.pstream.mov).
 * Best-effort  returns {} on any failure so stream resolve still succeeds.
 */
export async function getShowboxSubtitles(opts: {
  showboxId: string | number;
  fid: string | number;
  type: "movie" | "show";
  season?: number;
  episode?: number;
}): Promise<ShowboxSubtitleMap> {
  const { showboxId, fid, type, season, episode } = opts;
  const cacheKey = [
    "subs",
    type,
    showboxId,
    fid,
    season ?? "",
    episode ?? "",
  ].join(":");

  const cached = febboxMetaCache.get(cacheKey) as ShowboxSubtitleMap | undefined;
  if (cached) return cached;

  try {
    const module = type === "movie" ? "Movie_srt_list_v2" : "TV_srt_list_v2";
    const params: Record<string, string | number> = {
      fid: String(fid),
      uid: "",
    };
    if (type === "movie") {
      params.mid = String(showboxId);
    } else {
      params.tid = String(showboxId);
      if (season != null) params.season = String(season);
      if (episode != null) params.episode = String(episode);
    }

    const result = (await showboxRequest(
      module,
      params,
    )) as CaptionApiResponse;
    const list = result?.data?.list;
    if (!Array.isArray(list) || list.length === 0) {
      febboxMetaCache.set(cacheKey, {}, 5 * 60_000);
      return {};
    }

    const out: ShowboxSubtitleMap = {};
    const seenLang = new Set<string>();

    for (const group of list) {
      const subs = Array.isArray(group?.subtitles) ? group.subtitles : [];
      if (subs.length === 0) continue;
      const best = [...subs].sort(
        (a, b) => (b.order ?? 0) - (a.order ?? 0),
      )[0];
      if (!best?.file_path || !best.lang) continue;

      const key = langKeyFor(best.lang);
      if (seenLang.has(key)) continue;
      seenLang.add(key);

      const url = rewriteCaptionUrl(best.file_path);
      out[key] = {
        subtitle_link: url,
        subtitle_name: key.charAt(0).toUpperCase() + key.slice(1),
      };
    }

    febboxMetaCache.set(cacheKey, out);
    return out;
  } catch {
    febboxMetaCache.set(cacheKey, {}, 60_000);
    return {};
  }
}
