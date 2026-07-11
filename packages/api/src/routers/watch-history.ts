import { watchHistory } from "@topwaatch/db/schema/watch-history";
import { and, desc, eq } from "drizzle-orm";
import { uuidv7 } from "uuidv7";
import { z } from "zod";

import { protectedProcedure, router } from "../index";
import { defaultAndCoerceDateTime, displayProgressId } from "../lib/progress";
import { requireUserId } from "../lib/user";
import {
  watchHistoryDeleteSchema,
  watchHistoryItemSchema,
} from "../schemas/watch-history";

function formatWatchHistoryListItem(item: typeof watchHistory.$inferSelect) {
  return {
    tmdbId: item.tmdbId,
    episode: {
      id: displayProgressId(item.episodeId) ?? undefined,
      number: item.episodeNumber ?? undefined,
    },
    season: {
      id: displayProgressId(item.seasonId) ?? undefined,
      number: item.seasonNumber ?? undefined,
    },
    meta: item.meta,
    duration: item.duration.toString(),
    watched: item.watched.toString(),
    watchedAt: item.watchedAt.toISOString(),
    completed: item.completed,
  };
}

function formatWatchHistoryItem(item: typeof watchHistory.$inferSelect) {
  return {
    success: true,
    id: item.id,
    tmdbId: item.tmdbId,
    userId: item.userId,
    seasonId: displayProgressId(item.seasonId),
    episodeId: displayProgressId(item.episodeId),
    seasonNumber: item.seasonNumber,
    episodeNumber: item.episodeNumber,
    meta: item.meta,
    duration: item.duration,
    watched: item.watched,
    watchedAt: item.watchedAt.toISOString(),
    completed: item.completed,
    updatedAt: item.updatedAt.toISOString(),
  };
}

export const watchHistoryRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    const userId = requireUserId(ctx);

    const items = await ctx.db.query.watchHistory.findMany({
      where: eq(watchHistory.userId, userId),
      orderBy: desc(watchHistory.watchedAt),
    });

    return items.map(formatWatchHistoryListItem);
  }),

  upsert: protectedProcedure
    .input(
      z.object({
        tmdbId: z.string(),
        data: z.union([watchHistoryItemSchema, watchHistoryItemSchema.array().max(1000)]),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const userId = requireUserId(ctx);
      const parsed = input.data;
      const items = Array.isArray(parsed) ? parsed : [parsed];

      const results = await ctx.db.transaction(async (tx) => {
        const upserted: Array<typeof watchHistory.$inferSelect> = [];

        for (const validatedBody of items) {
          const itemTmdbId = items.length === 1 ? input.tmdbId : (validatedBody.tmdbId ?? input.tmdbId);
          const watchedAt = defaultAndCoerceDateTime(validatedBody.watchedAt);
          const now = new Date();
          const normSeasonId = validatedBody.seasonId || "\n";
          const normEpisodeId = validatedBody.episodeId || "\n";

          const [row] = await tx
            .insert(watchHistory)
            .values({
              id: uuidv7(),
              tmdbId: itemTmdbId,
              userId,
              seasonId: normSeasonId,
              episodeId: normEpisodeId,
              seasonNumber: validatedBody.seasonNumber ?? null,
              episodeNumber: validatedBody.episodeNumber ?? null,
              duration: parseFloat(validatedBody.duration),
              watched: parseFloat(validatedBody.watched),
              watchedAt,
              completed: validatedBody.completed,
              meta: validatedBody.meta,
              updatedAt: now,
            })
            .onConflictDoUpdate({
              target: [
                watchHistory.tmdbId,
                watchHistory.userId,
                watchHistory.seasonId,
                watchHistory.episodeId,
              ],
              set: {
                duration: parseFloat(validatedBody.duration),
                watched: parseFloat(validatedBody.watched),
                watchedAt,
                completed: validatedBody.completed,
                meta: validatedBody.meta,
                updatedAt: now,
                seasonNumber: validatedBody.seasonNumber ?? null,
                episodeNumber: validatedBody.episodeNumber ?? null,
              },
            })
            .returning();

          if (!row) throw new Error("Failed to upsert watch history item");
          upserted.push(row);
        }

        return upserted;
      });

      if (results.length === 1) {
        const only = results[0];
        if (!only) throw new Error("Failed to upsert watch history item");
        return formatWatchHistoryItem(only);
      }

      return {
        success: true,
        count: results.length,
        items: results.map(formatWatchHistoryItem),
      };
    }),

  delete: protectedProcedure
    .input(
      z.object({
        tmdbId: z.string(),
        data: watchHistoryDeleteSchema.optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const userId = requireUserId(ctx);
      const body = input.data ?? {};

      const conditions = [eq(watchHistory.userId, userId), eq(watchHistory.tmdbId, input.tmdbId)];

      if (body.seasonId) conditions.push(eq(watchHistory.seasonId, body.seasonId));
      if (body.episodeId) conditions.push(eq(watchHistory.episodeId, body.episodeId));

      const deleted = await ctx.db
        .delete(watchHistory)
        .where(and(...conditions))
        .returning({ id: watchHistory.id });

      return {
        success: true,
        count: deleted.length,
        tmdbId: input.tmdbId,
        episodeId: body.episodeId,
        seasonId: body.seasonId,
      };
    }),
});
