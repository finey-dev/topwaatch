import { relations } from "drizzle-orm";
import { index, jsonb, pgTable, text, timestamp, varchar } from "drizzle-orm/pg-core";

import { user } from "./auth";

/** Streaming profile data (P-Stream `users.profile`, `ratings`, `nickname`). */
export type UserProfileColors = {
  colorA: string;
  colorB: string;
  icon: string;
};

export type UserRating = {
  tmdbId: string;
  rating: number;
  updatedAt?: string;
};

export const userProfile = pgTable(
  "user_profile",
  {
    userId: text("user_id")
      .primaryKey()
      .references(() => user.id, { onDelete: "cascade" }),
    nickname: varchar("nickname", { length: 255 }).notNull(),
    profile: jsonb("profile").$type<UserProfileColors>().notNull(),
    ratings: jsonb("ratings").$type<UserRating[]>().notNull().default([]),
    lastLoggedInAt: timestamp("last_logged_in_at", { withTimezone: true, mode: "date" }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).defaultNow().notNull(),
  },
  (table) => [
    index("user_profile_nickname_idx").on(table.nickname),
    index("user_profile_last_logged_in_at_idx").on(table.lastLoggedInAt),
  ],
);

export const userProfileRelations = relations(userProfile, ({ one }) => ({
  user: one(user, {
    fields: [userProfile.userId],
    references: [user.id],
  }),
}));
