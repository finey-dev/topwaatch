import { TRPCError } from "@trpc/server";

import { rateLimitedProcedure, router } from "../index";
import { runScrapeForUser, scrapeInputSchema } from "../lib/scrape";

export const scrapeRouter = router({
  run: rateLimitedProcedure
    .input(scrapeInputSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        return await runScrapeForUser(input, ctx.session?.user?.id ?? null);
      } catch (err) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: err instanceof Error ? err.message : "Scrape failed",
        });
      }
    }),
});
