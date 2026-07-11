import { progressItems } from "@topwaatch/db/schema/progress";
import { and, eq, inArray, ne } from "drizzle-orm";
import pLimit from "p-limit";
import { uuidv7 } from "uuidv7";
import { z } from "zod";

import { protectedProcedure, router } from "../index";
import {
  defaultAndCoerceDateTime,
  displayProgressId,
  normalizeProgressIds,
  progressIsCompleted,
  progressIsNotStarted,
  shouldSaveProgressItem,
  toProgressBigInt,
} from "../lib/progress";
import { requireUserId } from "../lib/user";
import {
  progressDeleteSchema,
  progressImportItemSchema,
  progressItemSchema,
} from "../schemas/progress";

function formatProgressListItem(item: typeof progressItems.$inferSelect) {
  return {
    id: item.id,
    tmdbId: item.tmdbId,
    episode: {
      id: displayProgressId(item.episodeId),
      number: item.episodeNumber ?? null,
    },
    season: {
      id: displayProgressId(item.seasonId),
      number: item.seasonNumber ?? null,
    },
    meta: item.meta,
    duration: item.duration.toString(),
    watched: item.watched.toString(),
    updatedAt: item.updatedAt.toISOString(),
  };
}

function formatProgressItem(item: typeof progressItems.$inferSelect) {
  return {
    id: item.id,
    tmdbId: item.tmdbId,
    userId: item.userId,
    seasonId: displayProgressId(item.seasonId),
    episodeId: displayProgressId(item.episodeId),
    seasonNumber: item.seasonNumber,
    episodeNumber: item.episodeNumber,
    meta: item.meta,
    duration: Number(item.duration),
    watched: Number(item.watched),
    updatedAt: item.updatedAt,
  };
}

export const progressRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    const userId = requireUserId(ctx);

    const items = await ctx.db.query.progressItems.findMany({
      where: eq(progressItems.userId, userId),
    });

    return items.map(formatProgressListItem);
  }),

  upsert: protectedProcedure
    .input(
      z.object({
        tmdbId: z.string(),
        data: progressItemSchema,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const userId = requireUserId(ctx);
      const validatedBody = input.data;
      const tmdbId = input.tmdbId;

      const seasonEpisodes = validatedBody.seasonId
        ? await ctx.db.query.progressItems.findMany({
            where: and(
              eq(progressItems.userId, userId),
              eq(progressItems.tmdbId, tmdbId),
              eq(progressItems.seasonId, validatedBody.seasonId),
              ...(validatedBody.episodeId
                ? [ne(progressItems.episodeId, validatedBody.episodeId)]
                : []),
            ),
          })
        : [];

      const shouldSave = shouldSaveProgressItem(validatedBody, seasonEpisodes);
      const { seasonId, episodeId } = normalizeProgressIds(
        validatedBody.seasonId,
        validatedBody.episodeId,
      );
      const now = defaultAndCoerceDateTime(validatedBody.updatedAt);

      if (!shouldSave) {
        return {
          id: "",
          tmdbId,
          userId,
          seasonId: displayProgressId(seasonId),
          episodeId: displayProgressId(episodeId),
          seasonNumber: validatedBody.seasonNumber ?? null,
          episodeNumber: validatedBody.episodeNumber ?? null,
          meta: validatedBody.meta,
          duration: parseInt(String(validatedBody.duration ?? 0), 10) || 0,
          watched: parseInt(String(validatedBody.watched ?? 0), 10) || 0,
          updatedAt: now,
        };
      }

      const duration = toProgressBigInt(validatedBody.duration);
      const watched = toProgressBigInt(validatedBody.watched);

      const [row] = await ctx.db
        .insert(progressItems)
        .values({
          id: uuidv7(),
          tmdbId,
          userId,
          seasonId,
          episodeId,
          seasonNumber: validatedBody.seasonNumber ?? null,
          episodeNumber: validatedBody.episodeNumber ?? null,
          duration,
          watched,
          meta: validatedBody.meta,
          updatedAt: now,
        })
        .onConflictDoUpdate({
          target: [
            progressItems.tmdbId,
            progressItems.userId,
            progressItems.seasonId,
            progressItems.episodeId,
          ],
          set: {
            duration,
            watched,
            meta: validatedBody.meta,
            updatedAt: now,
            seasonNumber: validatedBody.seasonNumber ?? null,
            episodeNumber: validatedBody.episodeNumber ?? null,
          },
        })
        .returning();

      if (!row) throw new Error("Failed to upsert progress item");
      return formatProgressItem(row);
    }),

  delete: protectedProcedure
    .input(
      z.object({
        tmdbId: z.string(),
        data: progressDeleteSchema.optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const userId = requireUserId(ctx);
      const body = input.data ?? {};

      const conditions = [
        eq(progressItems.userId, userId),
        eq(progressItems.tmdbId, input.tmdbId),
      ];

      if (body.seasonId) {
        conditions.push(eq(progressItems.seasonId, body.seasonId));
      } else if (body.meta?.type === "movie") {
        conditions.push(eq(progressItems.seasonId, "\n"));
      }

      if (body.episodeId) {
        conditions.push(eq(progressItems.episodeId, body.episodeId));
      } else if (body.meta?.type === "movie") {
        conditions.push(eq(progressItems.episodeId, "\n"));
      }

      const deleted = await ctx.db
        .delete(progressItems)
        .where(and(...conditions))
        .returning({ id: progressItems.id });

      return {
        count: deleted.length,
        tmdbId: input.tmdbId,
        episodeId: body.episodeId,
        seasonId: body.seasonId,
      };
    }),

  cleanup: protectedProcedure.mutation(async ({ ctx }) => {
    const userId = requireUserId(ctx);

    const allItems = await ctx.db.query.progressItems.findMany({
      where: eq(progressItems.userId, userId),
    });

    const itemsToDelete: string[] = [];
    const itemsByTmdbId: Record<string, typeof allItems> = {};

    for (const item of allItems) {
      const bucket = itemsByTmdbId[item.tmdbId] ?? (itemsByTmdbId[item.tmdbId] = []);
      bucket.push(item);
    }

    for (const items of Object.values(itemsByTmdbId)) {
      const movieItems = items.filter((item) => !item.episodeId || item.episodeId === "\n");
      const episodeItems = items.filter((item) => item.episodeId && item.episodeId !== "\n");

      for (const item of movieItems) {
        const duration = Number(item.duration);
        const watched = Number(item.watched);
        if (
          progressIsNotStarted(duration, watched) ||
          progressIsCompleted(duration, watched)
        ) {
          itemsToDelete.push(item.id);
        }
      }

      const episodesBySeason: Record<string, typeof episodeItems> = {};
      for (const item of episodeItems) {
        const seasonKey = `${item.seasonId}`;
        if (!episodesBySeason[seasonKey]) episodesBySeason[seasonKey] = [];
        episodesBySeason[seasonKey].push(item);
      }

      for (const seasonItems of Object.values(episodesBySeason)) {
        const hasAcceptableEpisodes = seasonItems.some((item) => {
          const duration = Number(item.duration);
          const watched = Number(item.watched);
          return !progressIsNotStarted(duration, watched) && !progressIsCompleted(duration, watched);
        });

        if (hasAcceptableEpisodes) {
          for (const item of seasonItems) {
            const duration = Number(item.duration);
            const watched = Number(item.watched);
            if (
              progressIsNotStarted(duration, watched) ||
              progressIsCompleted(duration, watched)
            ) {
              itemsToDelete.push(item.id);
            }
          }
        } else {
          itemsToDelete.push(...seasonItems.map((item) => item.id));
        }
      }
    }

    if (itemsToDelete.length > 0) {
      await ctx.db
        .delete(progressItems)
        .where(and(eq(progressItems.userId, userId), inArray(progressItems.id, itemsToDelete)));
    }

    return {
      deletedCount: itemsToDelete.length,
      message: `Cleaned up ${itemsToDelete.length} unwanted progress items`,
    };
  }),

  importMany: protectedProcedure
    .input(progressImportItemSchema.array().max(5000))
    .mutation(async ({ ctx, input }) => {
      const userId = requireUserId(ctx);

      const existingItems = await ctx.db.query.progressItems.findMany({
        where: eq(progressItems.userId, userId),
      });

      const newItems = [...input];
      const itemsToUpsert: Array<typeof progressItems.$inferInsert> = [];

      for (const existingItem of existingItems) {
        const newItemIndex = newItems.findIndex(
          (item) =>
            item.tmdbId === existingItem.tmdbId &&
            item.seasonId === displayProgressId(existingItem.seasonId) &&
            item.episodeId === displayProgressId(existingItem.episodeId),
        );

        if (newItemIndex > -1) {
          const newItem = newItems[newItemIndex];
          if (newItem && Number(existingItem.watched) < newItem.watched) {
            const isMovie = newItem.meta.type === "movie";
            itemsToUpsert.push({
              id: existingItem.id,
              tmdbId: existingItem.tmdbId,
              userId: existingItem.userId,
              seasonId: isMovie ? "\n" : existingItem.seasonId,
              episodeId: isMovie ? "\n" : existingItem.episodeId,
              seasonNumber: existingItem.seasonNumber,
              episodeNumber: existingItem.episodeNumber,
              duration: toProgressBigInt(newItem.duration),
              watched: toProgressBigInt(newItem.watched),
              meta: newItem.meta,
              updatedAt: defaultAndCoerceDateTime(newItem.updatedAt),
            });
          }
          newItems.splice(newItemIndex, 1);
        }
      }

      for (const item of newItems) {
        const isMovie = item.meta.type === "movie";
        itemsToUpsert.push({
          id: uuidv7(),
          tmdbId: item.tmdbId,
          userId,
          seasonId: isMovie ? "\n" : item.seasonId || null,
          episodeId: isMovie ? "\n" : item.episodeId || null,
          seasonNumber: isMovie ? null : item.seasonNumber,
          episodeNumber: isMovie ? null : item.episodeNumber,
          duration: toProgressBigInt(item.duration),
          watched: toProgressBigInt(item.watched),
          meta: item.meta,
          updatedAt: defaultAndCoerceDateTime(item.updatedAt),
        });
      }

      if (itemsToUpsert.length === 0) return [];

      const limit = pLimit(10);
      const transactionResults = await Promise.all(
        itemsToUpsert.map((item) =>
          limit(async () => {
            const [row] = await ctx.db
              .insert(progressItems)
              .values(item)
              .onConflictDoUpdate({
                target: [
                  progressItems.tmdbId,
                  progressItems.userId,
                  progressItems.seasonId,
                  progressItems.episodeId,
                ],
                set: {
                  duration: item.duration,
                  watched: item.watched,
                  meta: item.meta,
                  updatedAt: item.updatedAt,
                },
              })
              .returning();
            return row;
          }),
        ),
      );

      return transactionResults
        .filter((result): result is NonNullable<typeof result> => result != null)
        .map((result) => ({
          id: result.id,
          tmdbId: result.tmdbId,
          episode: {
            id: displayProgressId(result.episodeId),
            number: result.episodeNumber,
          },
          season: {
            id: displayProgressId(result.seasonId),
            number: result.seasonNumber,
          },
          meta: result.meta,
          duration: result.duration.toString(),
          watched: result.watched.toString(),
          updatedAt: result.updatedAt.toISOString(),
        }));
    }),
});
