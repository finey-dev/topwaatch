import { publicProcedure, router } from "../index";

import { bookmarksRouter } from "./bookmarks";
import { discoverRouter } from "./discover";
import { groupOrderRouter } from "./group-order";
import { listsRouter } from "./lists";
import { meRouter } from "./me";
import { metaRouter } from "./meta";
import { playerRouter } from "./player";
import { profileRouter, ratingsRouter } from "./profile";
import { progressRouter } from "./progress";
import { scrapeRouter } from "./scrape";
import { settingsRouter } from "./settings";
import { watchHistoryRouter } from "./watch-history";

export const appRouter = router({
  healthCheck: publicProcedure.query(() => "OK"),

  me: meRouter,
  bookmarks: bookmarksRouter,
  progress: progressRouter,
  watchHistory: watchHistoryRouter,
  settings: settingsRouter,
  groupOrder: groupOrderRouter,
  lists: listsRouter,
  profile: profileRouter,
  ratings: ratingsRouter,

  scrape: scrapeRouter,
  player: playerRouter,
  discover: discoverRouter,
  meta: metaRouter,
});

export type AppRouter = typeof appRouter;
