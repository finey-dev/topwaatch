/* eslint-disable no-console */
import { PlayerMeta } from "@/stores/player/slices/source";

import { scrapeNatsukiCaptions } from "./natsuki";
import { scrapeOpenSubtitlesCaptions } from "./opensubtitles";
import { scrapeVdrkCaptions } from "./vdrk";
import { scrapeWyzieCaptions } from "./wyzie";

export async function scrapeExternalSubtitles(
  meta: PlayerMeta,
): Promise<import("@/stores/player/slices/source").CaptionListItem[]> {
  try {
    const imdbId = meta.imdbId;
    const tmdbId = meta.tmdbId;

    if (!imdbId && !tmdbId) {
      console.log(
        "No IMDb or TMDB ID available for external subtitle scraping",
      );
      return [];
    }

    const season = meta.season?.number;
    const episode = meta.episode?.number;

    // Wyzie aggregates multiple upstream sources so needs a longer timeout
    const wyzieTimeout = 30000;
    const natsukiTimeout = 30000;
    const timeout = 10000;

    const wyziePromise = scrapeWyzieCaptions(
      tmdbId,
      imdbId ?? "",
      season,
      episode,
    );
    const natsukiPromise = scrapeNatsukiCaptions(
      tmdbId,
      imdbId ?? "",
      season,
      episode,
    );
    const openSubsPromise = imdbId
      ? scrapeOpenSubtitlesCaptions(imdbId, season, episode)
      : Promise.resolve([]);
    const vdrkPromise = scrapeVdrkCaptions(tmdbId, season, episode);

    const wyzieTimeoutPromise = new Promise<
      import("@/stores/player/slices/source").CaptionListItem[]
    >((resolve) => {
      setTimeout(() => resolve([]), wyzieTimeout);
    });
    const natsukiTimeoutPromise = new Promise<
      import("@/stores/player/slices/source").CaptionListItem[]
    >((resolve) => {
      setTimeout(() => resolve([]), natsukiTimeout);
    });
    const timeoutPromise = new Promise<
      import("@/stores/player/slices/source").CaptionListItem[]
    >((resolve) => {
      setTimeout(() => resolve([]), timeout);
    });

    const allCaptions: import("@/stores/player/slices/source").CaptionListItem[] =
      [];
    let completedSources = 0;
    const totalSources = 4;

    const handleSourceCompletion = (
      sourceName: string,
      captions: import("@/stores/player/slices/source").CaptionListItem[],
    ) => {
      allCaptions.push(...captions);
      completedSources += 1;
      console.log(
        `${sourceName} completed with ${captions.length} captions (${completedSources}/${totalSources} sources done)`,
      );
    };

    const promises = [
      Promise.race([natsukiPromise, natsukiTimeoutPromise]).then((captions) => {
        handleSourceCompletion("Natsuki", captions);
        return captions;
      }),
      Promise.race([wyziePromise, wyzieTimeoutPromise]).then((captions) => {
        handleSourceCompletion("Wyzie", captions);
        return captions;
      }),
      Promise.race([openSubsPromise, timeoutPromise]).then((captions) => {
        handleSourceCompletion("OpenSubtitles", captions);
        return captions;
      }),
      Promise.race([vdrkPromise, timeoutPromise]).then((captions) => {
        handleSourceCompletion("Granite", captions);
        return captions;
      }),
    ];

    await Promise.allSettled(promises);

    console.log(
      `Found ${allCaptions.length} total external captions from all sources`,
    );

    return allCaptions;
  } catch (error) {
    console.error("Error in scrapeExternalSubtitles:", error);
    return [];
  }
}

export { scrapeWyzieCaptions } from "./wyzie";
export { scrapeNatsukiCaptions } from "./natsuki";
export { scrapeOpenSubtitlesCaptions } from "./opensubtitles";
export { scrapeVdrkCaptions } from "./vdrk";
