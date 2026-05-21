ALTER TABLE "post_translations" ADD COLUMN IF NOT EXISTS "canonical_url" text NOT NULL DEFAULT '';--> statement-breakpoint
ALTER TABLE "post_translations" ADD COLUMN IF NOT EXISTS "og_image" text NOT NULL DEFAULT '';--> statement-breakpoint
ALTER TABLE "post_translations" ADD COLUMN IF NOT EXISTS "structured_data" jsonb NOT NULL DEFAULT '{}'::jsonb;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "post_translations_seo_title_idx" ON "post_translations" USING btree ("seo_title");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "post_translations_canonical_url_idx" ON "post_translations" USING btree ("canonical_url");
