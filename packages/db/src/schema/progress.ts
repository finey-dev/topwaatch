import { relations } from "drizzle-orm";
import {
  bigint,
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

export const progressItems = pgTable(
  "progress_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tmdbId: varchar("tmdb_id", { length: 255 }).notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    seasonId: varchar("season_id", { length: 255 }),
    episodeId: varchar("episode_id", { length: 255 }),
    meta: jsonb("meta").notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull(),
    duration: bigint("duration", { mode: "bigint" }).notNull(),
    watched: bigint("watched", { mode: "bigint" }).notNull(),
    seasonNumber: integer("season_number"),
    episodeNumber: integer("episode_number"),
  },
  (table) => [
    unique("progress_items_tmdb_id_user_id_season_id_episode_id_unique").on(
      table.tmdbId,
      table.userId,
      table.seasonId,
      table.episodeId,
    ),
    index("progress_items_user_id_idx").on(table.userId),
    index("progress_items_user_id_updated_at_idx").on(table.userId, table.updatedAt),
    index("progress_items_user_id_tmdb_id_idx").on(table.userId, table.tmdbId),
    index("progress_items_user_id_tmdb_id_season_id_idx").on(
      table.userId,
      table.tmdbId,
      table.seasonId,
    ),
  ],
);

export const progressItemsRelations = relations(progressItems, ({ one }) => ({
  user: one(user, {
    fields: [progressItems.userId],
    references: [user.id],
  }),
}));
