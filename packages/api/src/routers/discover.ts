import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { publicProcedure, router } from "../index";
import {
  DISCOVER_LIST_SLUGS,
  emptyList,
  fetchDiscoverAggregate,
  fetchDiscoverList,
  fetchNetworkProviders,
  fetchReleaseDetails,
} from "../lib/discover";

export const discoverRouter = router({
  /** Featured carousel content (TraktListResponse for slug "discover"). */
  content: publicProcedure.query(async () => {
    try {
      return await fetchDiscoverList("discover");
    } catch (err) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: err instanceof Error ? err.message : "Discover failed",
        cause: emptyList(),
      });
    }
  }),

  aggregate: publicProcedure.query(async () => {
    try {
      return await fetchDiscoverAggregate();
    } catch (err) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: err instanceof Error ? err.message : "Discover failed",
      });
    }
  }),

  release: publicProcedure
    .input(
      z.object({
        id: z.string().min(1),
        season: z.number().int().optional(),
        episode: z.number().int().optional(),
      }),
    )
    .query(async ({ input }) => {
      try {
        return await fetchReleaseDetails(
          input.id,
          input.season,
          input.episode,
        );
      } catch (err) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message:
            err instanceof Error ? err.message : "Release lookup failed",
        });
      }
    }),

  network: publicProcedure
    .input(z.object({ tmdbId: z.string().min(1) }))
    .query(async ({ input }) => {
      try {
        return await fetchNetworkProviders(input.tmdbId);
      } catch (err) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message:
            err instanceof Error ? err.message : "Network lookup failed",
        });
      }
    }),

  list: publicProcedure
    .input(
      z.object({
        slug: z.enum(DISCOVER_LIST_SLUGS as [string, ...string[]]),
      }),
    )
    .query(async ({ input }) => {
      try {
        return await fetchDiscoverList(input.slug);
      } catch (err) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: err instanceof Error ? err.message : "List fetch failed",
          cause: emptyList(),
        });
      }
    }),
});
