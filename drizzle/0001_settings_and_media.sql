CREATE TABLE IF NOT EXISTS "app_settings" (
	"key" varchar(120) PRIMARY KEY NOT NULL,
	"value" text NOT NULL,
	"encrypted" boolean DEFAULT false NOT NULL,
	"updated_by" uuid REFERENCES "users"("id") ON DELETE SET NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "media_assets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"url" text NOT NULL,
	"alt_text" varchar(255) DEFAULT '' NOT NULL,
	"caption" text DEFAULT '' NOT NULL,
	"storage_provider" varchar(40) DEFAULT 'external_url' NOT NULL,
	"mime_type" varchar(120),
	"width" integer,
	"height" integer,
	"file_size" integer,
	"created_by" uuid REFERENCES "users"("id") ON DELETE SET NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp
);--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS "media_assets_url_unique" ON "media_assets" USING btree ("url");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "media_assets_created_at_idx" ON "media_assets" USING btree ("created_at");--> statement-breakpoint

ALTER TABLE "posts" ADD COLUMN IF NOT EXISTS "cover_image_id" uuid REFERENCES "media_assets"("id") ON DELETE SET NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "posts_cover_image_idx" ON "posts" USING btree ("cover_image_id");--> statement-breakpoint

INSERT INTO "media_assets" ("url", "alt_text", "storage_provider")
SELECT DISTINCT "cover_image", '', 'external_url'
FROM "posts"
WHERE coalesce("cover_image", '') <> ''
ON CONFLICT ("url") DO NOTHING;--> statement-breakpoint

UPDATE "posts"
SET "cover_image_id" = "media_assets"."id"
FROM "media_assets"
WHERE "posts"."cover_image_id" IS NULL
	AND "posts"."cover_image" = "media_assets"."url"
	AND coalesce("posts"."cover_image", '') <> '';
