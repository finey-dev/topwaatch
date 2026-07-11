import { relations } from "drizzle-orm";
import { index, jsonb, pgTable, primaryKey, text, timestamp, varchar } from "drizzle-orm/pg-core";

import { user } from "./auth";

export const bookmarks = pgTable(
  "bookmarks",
  {
    tmdbId: varchar("tmdb_id", { length: 255 }).notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    meta: jsonb("meta").notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull(),
    group: text("group").array().notNull().default([]),
    favoriteEpisodes: text("favorite_episodes").array().notNull().default([]),
  },
  (table) => [
    primaryKey({ columns: [table.tmdbId, table.userId] }),
    index("bookmarks_user_id_idx").on(table.userId),
    index("bookmarks_user_id_updated_at_idx").on(table.userId, table.updatedAt),
    index("bookmarks_tmdb_id_idx").on(table.tmdbId),
  ],
);

export const bookmarksRelations = relations(bookmarks, ({ one }) => ({
  user: one(user, {
    fields: [bookmarks.userId],
    references: [user.id],
  }),
}));
