ALTER TABLE "category_translations" ADD COLUMN IF NOT EXISTS "seo_title" varchar(255) NOT NULL DEFAULT '';--> statement-breakpoint
ALTER TABLE "category_translations" ADD COLUMN IF NOT EXISTS "seo_description" varchar(500) NOT NULL DEFAULT '';--> statement-breakpoint
ALTER TABLE "tag_translations" ADD COLUMN IF NOT EXISTS "seo_title" varchar(255) NOT NULL DEFAULT '';--> statement-breakpoint
ALTER TABLE "tag_translations" ADD COLUMN IF NOT EXISTS "seo_description" varchar(500) NOT NULL DEFAULT '';--> statement-breakpoint

UPDATE "category_translations"
SET
	"seo_title" = coalesce("categories"."seo_title", ''),
	"seo_description" = coalesce("categories"."seo_description", '')
FROM "categories"
WHERE "category_translations"."category_id" = "categories"."id"
	AND "category_translations"."locale" = 'en'
	AND (
		coalesce("category_translations"."seo_title", '') = ''
		OR coalesce("category_translations"."seo_description", '') = ''
	);--> statement-breakpoint

UPDATE "tag_translations"
SET
	"seo_title" = coalesce("tags"."seo_title", ''),
	"seo_description" = coalesce("tags"."seo_description", '')
FROM "tags"
WHERE "tag_translations"."tag_id" = "tags"."id"
	AND "tag_translations"."locale" = 'en'
	AND (
		coalesce("tag_translations"."seo_title", '') = ''
		OR coalesce("tag_translations"."seo_description", '') = ''
	);
