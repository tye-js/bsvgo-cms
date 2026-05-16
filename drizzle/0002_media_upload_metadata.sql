ALTER TABLE "media_assets" ADD COLUMN IF NOT EXISTS "storage_key" text;--> statement-breakpoint
ALTER TABLE "media_assets" ADD COLUMN IF NOT EXISTS "original_filename" varchar(255);--> statement-breakpoint
ALTER TABLE "media_assets" ADD COLUMN IF NOT EXISTS "checksum" varchar(128);
