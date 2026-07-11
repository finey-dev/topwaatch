import { Qualities, Stream } from "@topwaatch/providers";

import { QualityStore } from "@/stores/quality";

export type SourceQuality = Qualities;

export type StreamType = "hls" | "mp4";

export type SourceFileStream = {
  type: "mp4";
  url: string;
};

export type LoadableSource = {
  type: StreamType;
  url: string;
  headers?: Stream["headers"];
  preferredHeaders?: Stream["preferredHeaders"];
};

export type SourceSliceSource =
  | {
      type: "file";
      qualities: Partial<Record<SourceQuality, SourceFileStream>>;
      headers?: Stream["headers"];
      preferredHeaders?: Stream["preferredHeaders"];
    }
  | {
      type: "hls";
      url: string;
      headers?: Stream["headers"];
      preferredHeaders?: Stream["preferredHeaders"];
    }
  | {
      type: "iframe";
      /** Full Peachify (or compatible) embed URL rendered as <iframe src> */
      embedUrl: string;
      startAt?: number;
    };

const qualitySorting: Record<SourceQuality, number> = {
  unknown: 0,
  "360": 10,
  "480": 20,
  "720": 30,
  "1080": 40,
  "4k": 35, // 4k has lower priority, you need faster internet for it
};
const sortedQualities: SourceQuality[] = Object.entries(qualitySorting)
  .sort((a, b) => b[1] - a[1])
  .map<SourceQuality>((v) => v[0] as SourceQuality);

/** VidLink and similar CDNs put codec in the path (`/h265/`, `x265`, `hevc`). */
export function isLikelyHevcUrl(url: string): boolean {
  // Also decode percent-encoded characters so proxied URLs like
  // `?destination=https%3A%2F%2F.../h265/...` are matched correctly.
  let decoded = url;
  try {
    decoded = decodeURIComponent(url);
  } catch {
    // leave as-is if decoding fails
  }
  return /(?:^|[/\-_.])(?:h265|hevc|x265|hev1|hvc1)(?:[/\-_.?]|$)/i.test(decoded);
}

let hevcSupportCache: boolean | null = null;

/**
 * Chrome on Linux often cannot decode HEVC in <video>  prefer H.264 when possible.
 *
 * Policy (deliberately not full P-Stream parity):
 * - Prefer H.264 for automatic / initial quality selection.
 * - Hide and refuse HEVC qualities when canPlayType says the browser can't
 *   decode them (prevents black video + audio on quality switch).
 * - Skip HEVC-only sources during scrape so we don't get stuck.
 * - On browsers that report HEVC support, behave like P-Stream (offer all).
 */
export function browserCanPlayHevc(): boolean {
  if (typeof document === "undefined") return true;
  if (hevcSupportCache !== null) return hevcSupportCache;
  const video = document.createElement("video");
  const result =
    video.canPlayType('video/mp4; codecs="hev1.1.6.L93.B0"') !== "" ||
    video.canPlayType('video/mp4; codecs="hvc1.1.6.L93.B0"') !== "";
  hevcSupportCache = result;
  return result;
}

/** True when every file quality looks like HEVC and the browser can't play it. */
export function isUnplayableHevcOnlySource(source: SourceSliceSource): boolean {
  if (source.type !== "file") return false;
  if (browserCanPlayHevc()) return false;
  const urls = Object.values(source.qualities)
    .map((q) => q?.url)
    .filter((url): url is string => Boolean(url?.length));
  if (urls.length === 0) return false;
  return urls.every((url) => isLikelyHevcUrl(url));
}

export function getPreferredQuality(
  availableQualites: SourceQuality[],
  qualityPreferences: QualityStore["quality"],
) {
  if (
    qualityPreferences.automaticQuality ||
    qualityPreferences.lastChosenQuality === null ||
    qualityPreferences.lastChosenQuality === "unknown"
  ) {
    // For automatic quality, select the best available quality
    // Sort by our quality preference order and pick the first (best) available
    return sortedQualities.find((v) => availableQualites.includes(v));
  }

  // get preferred quality - not automatic or unknown
  const chosenQualityIndex = sortedQualities.indexOf(
    qualityPreferences.lastChosenQuality,
  );
  let nearestChoseQuality: undefined | SourceQuality;

  // check chosen quality or lower
  for (let i = chosenQualityIndex; i < sortedQualities.length; i += 1) {
    if (availableQualites.includes(sortedQualities[i])) {
      nearestChoseQuality = sortedQualities[i];
      break;
    }
  }
  if (nearestChoseQuality) return nearestChoseQuality;

  // chosen quality or lower doesn't exist, try higher
  for (let i = chosenQualityIndex; i >= 0; i -= 1) {
    if (availableQualites.includes(sortedQualities[i])) {
      nearestChoseQuality = sortedQualities[i];
      break;
    }
  }
  return nearestChoseQuality;
}

/** Qualities whose URLs the current browser can actually decode. */
export function getPlayableFileQualities(
  source: Extract<SourceSliceSource, { type: "file" }>,
): SourceQuality[] {
  const allowHevc = browserCanPlayHevc();
  return Object.entries(source.qualities)
    .filter((entry) => (entry[1].url.length ?? 0) > 0)
    .filter((entry) => allowHevc || !isLikelyHevcUrl(entry[1].url))
    .map((entry) => entry[0]) as SourceQuality[];
}

export function selectQuality(
  source: SourceSliceSource,
  qualityPreferences: QualityStore["quality"],
): {
  stream: LoadableSource;
  quality: null | SourceQuality;
} {
  if (source.type === "hls")
    return {
      stream: source,
      quality: null,
    };
  if (source.type === "file") {
    const availableQualities = getPlayableFileQualities(source);

    // If the browser can't play HEVC and every quality is HEVC, throw so the
    // player can move on to the next source rather than playing a black screen.
    if (availableQualities.length === 0) {
      throw new Error("HEVC-only source: browser cannot decode H.265");
    }

    // For file sources (MP4), always use manual quality selection since they don't support switching
    const manualQualityPreferences = {
      ...qualityPreferences,
      automaticQuality: false,
    };
    const quality = getPreferredQuality(
      availableQualities,
      manualQualityPreferences,
    );
    if (quality) {
      const stream = source.qualities[quality];
      if (stream) {
        // Merge parent headers onto the quality URL  required for Worker
        // proxy injection (replaces the old extension prepareStream path).
        return {
          stream: {
            ...stream,
            headers: source.headers,
            preferredHeaders: source.preferredHeaders,
          },
          quality,
        };
      }
    }
  }
  throw new Error("couldn't select quality");
}

const qualityNameMap: Record<SourceQuality, string> = {
  "4k": "4K",
  "1080": "1080p",
  "360": "360p",
  "480": "480p",
  "720": "720p",
  unknown: "unknown",
};

export const allQualities = Object.keys(qualityNameMap) as SourceQuality[];

export function qualityToString(quality: SourceQuality): string {
  return qualityNameMap[quality];
}
