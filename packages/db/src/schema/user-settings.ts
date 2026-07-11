import { relations } from "drizzle-orm";
import { boolean, jsonb, pgTable, text, varchar } from "drizzle-orm/pg-core";

import { user } from "./auth";

export const userSettings = pgTable("user_settings", {
  id: text("id")
    .primaryKey()
    .references(() => user.id, { onDelete: "cascade" }),

  applicationTheme: varchar("application_theme", { length: 255 }),
  customTheme: jsonb("custom_theme"),
  applicationLanguage: varchar("application_language", { length: 255 }),
  defaultSubtitleLanguage: varchar("default_subtitle_language", { length: 255 }),

  proxyUrls: text("proxy_urls").array().notNull().default([]),
  proxyTmdb: boolean("proxy_tmdb").notNull().default(false),

  traktKey: varchar("trakt_key", { length: 255 }),
  febboxKey: varchar("febbox_key", { length: 255 }),
  debridService: varchar("debrid_service", { length: 255 }),
  debridToken: varchar("debrid_token", { length: 255 }),
  tidbKey: varchar("tidb_key", { length: 255 }),

  sourceOrder: text("source_order").array().notNull().default([]),
  embedOrder: text("embed_order").array().notNull().default([]),
  disabledSources: text("disabled_sources").array().notNull().default([]),
  disabledEmbeds: text("disabled_embeds").array().notNull().default([]),
  homeSectionOrder: text("home_section_order").array().notNull().default([]),

  enableAutoplay: boolean("enable_autoplay").notNull().default(true),
  enableCarouselView: boolean("enable_carousel_view").notNull().default(false),
  enableDetailsModal: boolean("enable_details_modal").notNull().default(false),
  enableDiscover: boolean("enable_discover").notNull().default(true),
  enableFeatured: boolean("enable_featured").notNull().default(false),
  enableImageLogos: boolean("enable_image_logos").notNull().default(true),
  enableSkipCredits: boolean("enable_skip_credits").notNull().default(true),
  enableSourceOrder: boolean("enable_source_order").notNull().default(false),
  enableThumbnails: boolean("enable_thumbnails").notNull().default(false),
  enableDoubleClickToSeek: boolean("enable_double_click_to_seek").notNull().default(false),
  enableEmbedOrder: boolean("enable_embed_order").notNull().default(false),
  enableHoldToBoost: boolean("enable_hold_to_boost").notNull().default(false),
  enableLowPerformanceMode: boolean("enable_low_performance_mode").notNull().default(false),
  enableNativeSubtitles: boolean("enable_native_subtitles").notNull().default(false),
  forceCompactEpisodeView: boolean("force_compact_episode_view").notNull().default(false),
  manualSourceSelection: boolean("manual_source_selection").notNull().default(false),
  enableAutoResumeOnPlaybackError: boolean("enable_auto_resume_on_playback_error")
    .notNull()
    .default(false),
  enablePauseOverlay: boolean("enable_pause_overlay").notNull().default(false),
});

export const userSettingsRelations = relations(userSettings, ({ one }) => ({
  user: one(user, {
    fields: [userSettings.id],
    references: [user.id],
  }),
}));
