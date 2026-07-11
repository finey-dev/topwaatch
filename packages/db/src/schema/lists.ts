import { relations } from "drizzle-orm";
import {
  boolean,
  index,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

import { user } from "./auth";

export const lists = pgTable(
  "lists",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 255 }).notNull(),
    description: varchar("description", { length: 255 }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull(),
    isPublic: boolean("public").notNull().default(false),
  },
  (table) => [
    unique("lists_user_id_name_unique").on(table.userId, table.name),
    index("lists_user_id_idx").on(table.userId),
    index("lists_user_id_updated_at_idx").on(table.userId, table.updatedAt),
    index("lists_public_updated_at_idx").on(table.isPublic, table.updatedAt),
  ],
);

export const listItems = pgTable(
  "list_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    listId: uuid("list_id")
      .notNull()
      .references(() => lists.id, { onDelete: "cascade" }),
    tmdbId: varchar("tmdb_id", { length: 255 }).notNull(),
    addedAt: timestamp("added_at", { withTimezone: true, mode: "date" }).defaultNow().notNull(),
    type: varchar("type", { length: 255 }),
  },
  (table) => [
    unique("list_items_list_id_tmdb_id_unique").on(table.listId, table.tmdbId),
    index("list_items_list_id_idx").on(table.listId),
    index("list_items_list_id_added_at_idx").on(table.listId, table.addedAt),
    index("list_items_tmdb_id_idx").on(table.tmdbId),
  ],
);

export const listsRelations = relations(lists, ({ one, many }) => ({
  user: one(user, {
    fields: [lists.userId],
    references: [user.id],
  }),
  items: many(listItems),
}));

export const listItemsRelations = relations(listItems, ({ one }) => ({
  list: one(lists, {
    fields: [listItems.listId],
    references: [lists.id],
  }),
}));
