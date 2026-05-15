CREATE EXTENSION IF NOT EXISTS "pgcrypto";--> statement-breakpoint
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";--> statement-breakpoint

ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "role" varchar(20) NOT NULL DEFAULT 'editor';--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "deleted_at" timestamp;--> statement-breakpoint
UPDATE "users" SET "role" = CASE WHEN "is_admin" THEN 'admin' ELSE 'editor' END WHERE "role" IS NULL OR "role" = 'editor';--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "users_role_idx" ON "users" USING btree ("role");--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE cascade,
	"token_hash" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "sessions_token_hash_idx" ON "sessions" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sessions_user_idx" ON "sessions" USING btree ("user_id");--> statement-breakpoint

ALTER TABLE "categories" ADD COLUMN IF NOT EXISTS "updated_at" timestamp NOT NULL DEFAULT now();--> statement-breakpoint
ALTER TABLE "categories" ADD COLUMN IF NOT EXISTS "sort_order" integer NOT NULL DEFAULT 0;--> statement-breakpoint
ALTER TABLE "categories" ADD COLUMN IF NOT EXISTS "is_locked" boolean NOT NULL DEFAULT true;--> statement-breakpoint
ALTER TABLE "categories" ADD COLUMN IF NOT EXISTS "seo_title" varchar(255);--> statement-breakpoint
ALTER TABLE "categories" ADD COLUMN IF NOT EXISTS "seo_description" text;--> statement-breakpoint
ALTER TABLE "categories" ADD COLUMN IF NOT EXISTS "deleted_at" timestamp;--> statement-breakpoint

ALTER TABLE "category_translations" ADD COLUMN IF NOT EXISTS "created_at" timestamp NOT NULL DEFAULT now();--> statement-breakpoint
ALTER TABLE "category_translations" ADD COLUMN IF NOT EXISTS "updated_at" timestamp NOT NULL DEFAULT now();--> statement-breakpoint

ALTER TABLE "tags" ADD COLUMN IF NOT EXISTS "updated_at" timestamp NOT NULL DEFAULT now();--> statement-breakpoint
ALTER TABLE "tags" ADD COLUMN IF NOT EXISTS "seo_title" varchar(255);--> statement-breakpoint
ALTER TABLE "tags" ADD COLUMN IF NOT EXISTS "seo_description" text;--> statement-breakpoint
ALTER TABLE "tags" ADD COLUMN IF NOT EXISTS "deleted_at" timestamp;--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "tag_translations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tag_id" uuid NOT NULL REFERENCES "tags"("id") ON DELETE cascade,
	"locale" varchar(10) NOT NULL,
	"name" varchar(100) NOT NULL,
	"description" text NOT NULL DEFAULT ''
);--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "tag_translations_tag_locale_unique" ON "tag_translations" USING btree ("tag_id", "locale");--> statement-breakpoint
INSERT INTO "tag_translations" ("tag_id", "locale", "name", "description")
SELECT "id", 'en', "name", ''
FROM "tags"
ON CONFLICT ("tag_id", "locale") DO NOTHING;--> statement-breakpoint

ALTER TABLE "posts" ALTER COLUMN "cover_image" SET DEFAULT '';--> statement-breakpoint
ALTER TABLE "posts" ALTER COLUMN "published_at" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "posts" ADD COLUMN IF NOT EXISTS "status" varchar(20) NOT NULL DEFAULT 'published';--> statement-breakpoint
ALTER TABLE "posts" ADD COLUMN IF NOT EXISTS "sort_order" integer NOT NULL DEFAULT 0;--> statement-breakpoint
ALTER TABLE "posts" ADD COLUMN IF NOT EXISTS "pinned" boolean NOT NULL DEFAULT false;--> statement-breakpoint
ALTER TABLE "posts" ADD COLUMN IF NOT EXISTS "author_id" uuid REFERENCES "users"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "posts" ADD COLUMN IF NOT EXISTS "deleted_at" timestamp;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "posts_category_idx" ON "posts" USING btree ("category_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "posts_status_idx" ON "posts" USING btree ("status");--> statement-breakpoint

ALTER TABLE "post_translations" ADD COLUMN IF NOT EXISTS "created_at" timestamp NOT NULL DEFAULT now();--> statement-breakpoint
ALTER TABLE "post_translations" ADD COLUMN IF NOT EXISTS "updated_at" timestamp NOT NULL DEFAULT now();
