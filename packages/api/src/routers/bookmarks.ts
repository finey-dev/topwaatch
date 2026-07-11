import { bookmarks } from "@topwaatch/db/schema/bookmarks";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { protectedProcedure, router } from "../index";
import { requireUserId } from "../lib/user";
import {
  bookmarkDataSchema,
  bookmarkMetaSchema,
  bookmarkRequestSchema,
  normalizeBookmarkGroup,
} from "../schemas/bookmarks";

function formatBookmark(row: typeof bookmarks.$inferSelect) {
  return {
    tmdbId: row.tmdbId,
    meta: row.meta,
    group: row.group,
    favoriteEpisodes: row.favoriteEpisodes,
    updatedAt: row.updatedAt,
  };
}

export const bookmarksRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    const userId = requireUserId(ctx);

    const rows = await ctx.db.query.bookmarks.findMany({
      where: eq(bookmarks.userId, userId),
    });

    return rows.map(formatBookmark);
  }),

  upsertMany: protectedProcedure
    .input(bookmarkDataSchema.array().max(10000))
    .mutation(async ({ ctx, input }) => {
      const userId = requireUserId(ctx);
      if (input.length === 0) return [];

      const now = new Date();
      const results = await ctx.db.transaction(async (tx) => {
        const upserted = [];
        for (const item of input) {
          const [row] = await tx
            .insert(bookmarks)
            .values({
              tmdbId: item.tmdbId,
              userId,
              meta: item.meta,
              group: normalizeBookmarkGroup(item.group),
              favoriteEpisodes: item.favoriteEpisodes ?? [],
              updatedAt: now,
            })
            .onConflictDoUpdate({
              target: [bookmarks.tmdbId, bookmarks.userId],
              set: {
                meta: item.meta,
                group: normalizeBookmarkGroup(item.group),
                favoriteEpisodes: item.favoriteEpisodes ?? [],
                updatedAt: now,
              },
            })
            .returning();
          if (!row) throw new Error("Failed to upsert bookmark");
          upserted.push(row);
        }
        return upserted;
      });

      return results.map(formatBookmark);
    }),

  upsert: protectedProcedure
    .input(
      bookmarkRequestSchema.extend({
        tmdbId: z.string(),
        meta: bookmarkMetaSchema,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const userId = requireUserId(ctx);
      const now = new Date();

      const [row] = await ctx.db
        .insert(bookmarks)
        .values({
          tmdbId: input.tmdbId,
          userId,
          meta: input.meta,
          group: normalizeBookmarkGroup(input.group),
          favoriteEpisodes: input.favoriteEpisodes ?? [],
          updatedAt: now,
        })
        .onConflictDoUpdate({
          target: [bookmarks.tmdbId, bookmarks.userId],
          set: {
            meta: input.meta,
            group: normalizeBookmarkGroup(input.group),
            favoriteEpisodes: input.favoriteEpisodes ?? [],
            updatedAt: now,
          },
        })
        .returning();

      if (!row) throw new Error("Failed to upsert bookmark");
      return formatBookmark(row);
    }),

  delete: protectedProcedure
    .input(z.object({ tmdbId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const userId = requireUserId(ctx);

      await ctx.db
        .delete(bookmarks)
        .where(and(eq(bookmarks.userId, userId), eq(bookmarks.tmdbId, input.tmdbId)));

      return { success: true, tmdbId: input.tmdbId };
    }),
});
