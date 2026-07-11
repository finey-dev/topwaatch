import { relations } from "drizzle-orm";
import {
  boolean,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

import { user } from "./auth";

export const watchHistory = pgTable(
  "watch_history",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    tmdbId: varchar("tmdb_id", { length: 255 }).notNull(),
    seasonId: varchar("season_id", { length: 255 }),
    episodeId: varchar("episode_id", { length: 255 }),
    meta: jsonb("meta").notNull(),
    duration: doublePrecision("duration").notNull(),
    watched: doublePrecision("watched").notNull(),
    watchedAt: timestamp("watched_at", { withTimezone: true, mode: "date" }).notNull(),
    completed: boolean("completed").notNull().default(false),
    seasonNumber: integer("season_number"),
    episodeNumber: integer("episode_number"),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).defaultNow().notNull(),
  },
  (table) => [
    unique("watch_history_tmdb_id_user_id_season_id_episode_id_unique").on(
      table.tmdbId,
      table.userId,
      table.seasonId,
      table.episodeId,
    ),
    index("watch_history_user_id_idx").on(table.userId),
    index("watch_history_user_id_watched_at_idx").on(table.userId, table.watchedAt),
    index("watch_history_user_id_updated_at_idx").on(table.userId, table.updatedAt),
    index("watch_history_tmdb_id_idx").on(table.tmdbId),
  ],
);

export const watchHistoryRelations = relations(watchHistory, ({ one }) => ({
  user: one(user, {
    fields: [watchHistory.userId],
    references: [user.id],
  }),
}));
