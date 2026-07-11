import { labelToLanguageCode } from "@topwaatch/providers";

import { proxiedFetch } from "@/backend/helpers/fetch";
import { CaptionListItem } from "@/stores/player/slices/source";

const NATSUKI_BASE = "https://natsuki.fontaine.lol/search";

interface NatsukiSubtitleEntry {
  id?: string;
  url?: string;
  format?: string;
  encoding?: string;
  display?: string;
  language?: string;
  media?: string;
  isHearingImpaired?: boolean;
  source?: string;
  release?: string;
  releases?: string[];
  flagUrl?: string;
  origin?: string;
}

function mapEntries(data: unknown): CaptionListItem[] {
  if (!Array.isArray(data)) return [];
  return (data as NatsukiSubtitleEntry[])
    .filter((sub) => typeof sub.url === "string" && sub.url)
    .map((sub) => {
      const fmt =
        sub.format === "srt" || sub.format === "vtt" ? sub.format : "srt";
      const upstream = sub.source ?? "";
      const language =
        labelToLanguageCode(sub.language || "") ||
        labelToLanguageCode(sub.display || "") ||
        (/^[a-z]{2,3}(-[a-z0-9]+)*$/i.test(sub.language || "")
          ? (sub.language as string).toLowerCase()
          : "unknown");
      return {
        id: sub.id ?? sub.url!,
        language,
        url: sub.url!,
        type: fmt,
        needsProxy: false,
        opensubtitles: true,
        display: sub.display,
        media: sub.media,
        isHearingImpaired: sub.isHearingImpaired,
        source: `natsuki ${upstream}`.trim(),
        encoding: sub.encoding,
        flagUrl: sub.flagUrl,
        release: sub.release,
        releases: sub.releases,
        origin: sub.origin,
      } as CaptionListItem;
    });
}

export async function scrapeNatsukiCaptions(
  tmdbId: string | number,
  imdbId: string,
  season?: number,
  episode?: number,
): Promise<CaptionListItem[]> {
  const id = imdbId || (tmdbId ? String(tmdbId) : "");
  if (!id) return [];

  const query: Record<string, string> = {
    id,
    source: "all",
  };
  if (season && episode) {
    query.season = String(season);
    query.episode = String(episode);
  }

  try {
    // Natsuki has no CORS headers  must go through the Worker proxy
    const data = await proxiedFetch<unknown>(NATSUKI_BASE, {
      query,
    });
    return mapEntries(data);
  } catch (err) {
    // 404 / empty results are normal for some titles  don't spam as hard failures
    const status =
      typeof err === "object" &&
      err &&
      "statusCode" in err &&
      typeof (err as { statusCode?: unknown }).statusCode === "number"
        ? (err as { statusCode: number }).statusCode
        : undefined;
    if (status === 404) {
      console.warn("Natsuki: no subtitles for this title");
      return [];
    }
    console.warn("Natsuki fetch failed:", err);
    return [];
  }
}
