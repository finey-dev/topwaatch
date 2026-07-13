CREATE INDEX "account_provider_id_account_id_idx" ON "account" USING btree ("provider_id","account_id");--> statement-breakpoint
CREATE INDEX "session_user_id_expires_at_updated_at_idx" ON "session" USING btree ("user_id","expires_at","updated_at");--> statement-breakpoint
CREATE INDEX "progress_items_user_id_tmdb_id_season_id_idx" ON "progress_items" USING btree ("user_id","tmdb_id","season_id");