CREATE TABLE "bookmarks" (
	"tmdb_id" varchar(255) NOT NULL,
	"user_id" text NOT NULL,
	"meta" jsonb NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	"group" text[] DEFAULT '{}' NOT NULL,
	"favorite_episodes" text[] DEFAULT '{}' NOT NULL,
	CONSTRAINT "bookmarks_tmdb_id_user_id_pk" PRIMARY KEY("tmdb_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "progress_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tmdb_id" varchar(255) NOT NULL,
	"user_id" text NOT NULL,
	"season_id" varchar(255),
	"episode_id" varchar(255),
	"meta" jsonb NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	"duration" bigint NOT NULL,
	"watched" bigint NOT NULL,
	"season_number" integer,
	"episode_number" integer,
	CONSTRAINT "progress_items_tmdb_id_user_id_season_id_episode_id_unique" UNIQUE("tmdb_id","user_id","season_id","episode_id")
);
--> statement-breakpoint
CREATE TABLE "watch_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"tmdb_id" varchar(255) NOT NULL,
	"season_id" varchar(255),
	"episode_id" varchar(255),
	"meta" jsonb NOT NULL,
	"duration" double precision NOT NULL,
	"watched" double precision NOT NULL,
	"watched_at" timestamp with time zone NOT NULL,
	"completed" boolean DEFAULT false NOT NULL,
	"season_number" integer,
	"episode_number" integer,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "watch_history_tmdb_id_user_id_season_id_episode_id_unique" UNIQUE("tmdb_id","user_id","season_id","episode_id")
);
--> statement-breakpoint
CREATE TABLE "user_settings" (
	"id" text PRIMARY KEY NOT NULL,
	"application_theme" varchar(255),
	"custom_theme" jsonb,
	"application_language" varchar(255),
	"default_subtitle_language" varchar(255),
	"proxy_urls" text[] DEFAULT '{}' NOT NULL,
	"proxy_tmdb" boolean DEFAULT false NOT NULL,
	"trakt_key" varchar(255),
	"febbox_key" varchar(255),
	"debrid_service" varchar(255),
	"debrid_token" varchar(255),
	"tidb_key" varchar(255),
	"source_order" text[] DEFAULT '{}' NOT NULL,
	"embed_order" text[] DEFAULT '{}' NOT NULL,
	"disabled_sources" text[] DEFAULT '{}' NOT NULL,
	"disabled_embeds" text[] DEFAULT '{}' NOT NULL,
	"home_section_order" text[] DEFAULT '{}' NOT NULL,
	"enable_autoplay" boolean DEFAULT true NOT NULL,
	"enable_carousel_view" boolean DEFAULT false NOT NULL,
	"enable_details_modal" boolean DEFAULT false NOT NULL,
	"enable_discover" boolean DEFAULT true NOT NULL,
	"enable_featured" boolean DEFAULT false NOT NULL,
	"enable_image_logos" boolean DEFAULT true NOT NULL,
	"enable_skip_credits" boolean DEFAULT true NOT NULL,
	"enable_source_order" boolean DEFAULT false NOT NULL,
	"enable_thumbnails" boolean DEFAULT false NOT NULL,
	"enable_double_click_to_seek" boolean DEFAULT false NOT NULL,
	"enable_embed_order" boolean DEFAULT false NOT NULL,
	"enable_hold_to_boost" boolean DEFAULT false NOT NULL,
	"enable_low_performance_mode" boolean DEFAULT false NOT NULL,
	"enable_native_subtitles" boolean DEFAULT false NOT NULL,
	"force_compact_episode_view" boolean DEFAULT false NOT NULL,
	"manual_source_selection" boolean DEFAULT false NOT NULL,
	"enable_auto_resume_on_playback_error" boolean DEFAULT false NOT NULL,
	"enable_pause_overlay" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "list_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"list_id" uuid NOT NULL,
	"tmdb_id" varchar(255) NOT NULL,
	"added_at" timestamp with time zone DEFAULT now() NOT NULL,
	"type" varchar(255),
	CONSTRAINT "list_items_list_id_tmdb_id_unique" UNIQUE("list_id","tmdb_id")
);
--> statement-breakpoint
CREATE TABLE "lists" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" varchar(255),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	"public" boolean DEFAULT false NOT NULL,
	CONSTRAINT "lists_user_id_name_unique" UNIQUE("user_id","name")
);
--> statement-breakpoint
CREATE TABLE "user_group_order" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"group_order" text[] DEFAULT '{}' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_group_order_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "user_profile" (
	"user_id" text PRIMARY KEY NOT NULL,
	"nickname" varchar(255) NOT NULL,
	"profile" jsonb NOT NULL,
	"ratings" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"last_logged_in_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DROP INDEX "account_userId_idx";--> statement-breakpoint
DROP INDEX "session_userId_idx";--> statement-breakpoint
ALTER TABLE "bookmarks" ADD CONSTRAINT "bookmarks_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "progress_items" ADD CONSTRAINT "progress_items_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "watch_history" ADD CONSTRAINT "watch_history_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_settings" ADD CONSTRAINT "user_settings_id_user_id_fk" FOREIGN KEY ("id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "list_items" ADD CONSTRAINT "list_items_list_id_lists_id_fk" FOREIGN KEY ("list_id") REFERENCES "public"."lists"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lists" ADD CONSTRAINT "lists_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_group_order" ADD CONSTRAINT "user_group_order_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_profile" ADD CONSTRAINT "user_profile_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "bookmarks_user_id_idx" ON "bookmarks" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "bookmarks_user_id_updated_at_idx" ON "bookmarks" USING btree ("user_id","updated_at");--> statement-breakpoint
CREATE INDEX "bookmarks_tmdb_id_idx" ON "bookmarks" USING btree ("tmdb_id");--> statement-breakpoint
CREATE INDEX "progress_items_user_id_idx" ON "progress_items" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "progress_items_user_id_updated_at_idx" ON "progress_items" USING btree ("user_id","updated_at");--> statement-breakpoint
CREATE INDEX "progress_items_user_id_tmdb_id_idx" ON "progress_items" USING btree ("user_id","tmdb_id");--> statement-breakpoint
CREATE INDEX "watch_history_user_id_idx" ON "watch_history" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "watch_history_user_id_watched_at_idx" ON "watch_history" USING btree ("user_id","watched_at");--> statement-breakpoint
CREATE INDEX "watch_history_user_id_updated_at_idx" ON "watch_history" USING btree ("user_id","updated_at");--> statement-breakpoint
CREATE INDEX "watch_history_tmdb_id_idx" ON "watch_history" USING btree ("tmdb_id");--> statement-breakpoint
CREATE INDEX "list_items_list_id_idx" ON "list_items" USING btree ("list_id");--> statement-breakpoint
CREATE INDEX "list_items_list_id_added_at_idx" ON "list_items" USING btree ("list_id","added_at");--> statement-breakpoint
CREATE INDEX "list_items_tmdb_id_idx" ON "list_items" USING btree ("tmdb_id");--> statement-breakpoint
CREATE INDEX "lists_user_id_idx" ON "lists" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "lists_user_id_updated_at_idx" ON "lists" USING btree ("user_id","updated_at");--> statement-breakpoint
CREATE INDEX "lists_public_updated_at_idx" ON "lists" USING btree ("public","updated_at");--> statement-breakpoint
CREATE INDEX "user_group_order_user_id_idx" ON "user_group_order" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "user_profile_nickname_idx" ON "user_profile" USING btree ("nickname");--> statement-breakpoint
CREATE INDEX "user_profile_last_logged_in_at_idx" ON "user_profile" USING btree ("last_logged_in_at");--> statement-breakpoint
CREATE INDEX "account_user_id_idx" ON "account" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "account_provider_id_user_id_idx" ON "account" USING btree ("provider_id","user_id");--> statement-breakpoint
CREATE INDEX "session_user_id_idx" ON "session" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "session_expires_at_idx" ON "session" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "session_user_id_expires_at_idx" ON "session" USING btree ("user_id","expires_at");--> statement-breakpoint
CREATE INDEX "verification_expires_at_idx" ON "verification" USING btree ("expires_at");