ALTER TABLE "media_assets" ADD COLUMN IF NOT EXISTS "zh_alt_text" varchar(255) DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "media_assets" ADD COLUMN IF NOT EXISTS "en_alt_text" varchar(255) DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "media_assets" ADD COLUMN IF NOT EXISTS "zh_seo_title" varchar(255) DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "media_assets" ADD COLUMN IF NOT EXISTS "zh_seo_description" varchar(500) DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "media_assets" ADD COLUMN IF NOT EXISTS "en_seo_title" varchar(255) DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "media_assets" ADD COLUMN IF NOT EXISTS "en_seo_description" varchar(500) DEFAULT '' NOT NULL;--> statement-breakpoint

UPDATE "media_assets"
SET "zh_alt_text" = "alt_text"
WHERE "zh_alt_text" = ''
  AND "alt_text" <> '';--> statement-breakpoint

UPDATE "media_assets"
SET "zh_seo_description" = left(("metadata" ->> 'seoSummary'), 500)
WHERE "zh_seo_description" = ''
  AND coalesce("metadata" ->> 'seoSummary', '') <> '';
