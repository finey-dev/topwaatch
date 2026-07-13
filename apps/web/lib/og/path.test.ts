import { describe, expect, it } from "vitest";

import { extractMediaSlug, isSocialCrawler } from "./path";
import { decodeTMDBSlug } from "./tmdb";

describe("isSocialCrawler", () => {
  it("detects major link-preview bots", () => {
    expect(isSocialCrawler("facebookexternalhit/1.1")).toBe(true);
    expect(isSocialCrawler("Twitterbot/1.0")).toBe(true);
    expect(isSocialCrawler("Discordbot/2.0")).toBe(true);
    expect(isSocialCrawler("Mozilla/5.0 Chrome/120")).toBe(false);
  });
});

describe("extractMediaSlug", () => {
  it("reads TMDB slugs from details and media routes", () => {
    expect(extractMediaSlug("/details/tmdb-movie-550-fight-club")).toBe(
      "tmdb-movie-550-fight-club",
    );
    expect(
      extractMediaSlug("/media/tmdb-tv-1396-breaking-bad/season/episode"),
    ).toBe("tmdb-tv-1396-breaking-bad");
  });
});

describe("decodeTMDBSlug", () => {
  it("decodes movie and tv ids", () => {
    expect(decodeTMDBSlug("tmdb-movie-550-fight-club")).toEqual({
      id: "550",
      type: "movie",
    });
    expect(decodeTMDBSlug("tmdb-tv-1396-breaking-bad")).toEqual({
      id: "1396",
      type: "tv",
    });
    expect(decodeTMDBSlug("invalid")).toBeNull();
  });
});
