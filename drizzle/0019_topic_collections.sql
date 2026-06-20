CREATE TABLE IF NOT EXISTS "topic_collections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" varchar(140) NOT NULL,
	"status" varchar(20) DEFAULT 'draft' NOT NULL,
	"cover_image_id" uuid REFERENCES "media_assets"("id") ON DELETE SET NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp,
	CONSTRAINT "topic_collections_status_check" CHECK ("status" in ('draft', 'published', 'archived'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "topic_collections_slug_unique" ON "topic_collections" USING btree ("slug");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "topic_collections_status_sort_idx" ON "topic_collections" USING btree ("status","sort_order");--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "topic_collection_translations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"collection_id" uuid NOT NULL REFERENCES "topic_collections"("id") ON DELETE cascade,
	"locale" varchar(10) NOT NULL,
	"title" varchar(255) NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"seo_title" varchar(255) DEFAULT '' NOT NULL,
	"seo_description" varchar(500) DEFAULT '' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "topic_collection_translations_locale_check" CHECK ("locale" in ('en', 'zh'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "topic_collection_translations_collection_locale_unique" ON "topic_collection_translations" USING btree ("collection_id","locale");--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "topic_collection_posts" (
	"collection_id" uuid NOT NULL REFERENCES "topic_collections"("id") ON DELETE cascade,
	"post_id" uuid NOT NULL REFERENCES "posts"("id") ON DELETE cascade,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "topic_collection_posts_pk" PRIMARY KEY("collection_id","post_id")
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "topic_collection_posts_collection_sort_idx" ON "topic_collection_posts" USING btree ("collection_id","sort_order");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "topic_collection_posts_post_idx" ON "topic_collection_posts" USING btree ("post_id");--> statement-breakpoint

INSERT INTO "topic_collections" ("slug", "status", "sort_order", "created_at", "updated_at")
VALUES ('bsv-basics', 'published', 1000, now(), now())
ON CONFLICT ("slug") DO NOTHING;
--> statement-breakpoint

INSERT INTO "topic_collection_translations" (
	"collection_id",
	"locale",
	"title",
	"description",
	"seo_title",
	"seo_description",
	"created_at",
	"updated_at"
)
SELECT
	"topic_collections"."id",
	'zh',
	'BSV基础知识',
	'系统整理 BSV、区块链基础概念、协议能力和生态知识的专题文章。',
	'BSV基础知识',
	'系统学习 BSV、区块链基础概念、协议能力和生态知识，按文章创建时间整理成连续阅读专题。',
	now(),
	now()
FROM "topic_collections"
WHERE "topic_collections"."slug" = 'bsv-basics'
ON CONFLICT ("collection_id", "locale") DO NOTHING;
--> statement-breakpoint

INSERT INTO "topic_collection_translations" (
	"collection_id",
	"locale",
	"title",
	"description",
	"seo_title",
	"seo_description",
	"created_at",
	"updated_at"
)
SELECT
	"topic_collections"."id",
	'en',
	'BSV Basics',
	'A curated series covering BSV, blockchain fundamentals, protocol capabilities, and ecosystem knowledge.',
	'BSV Basics',
	'Learn BSV, blockchain fundamentals, protocol capabilities, and ecosystem knowledge through a curated article series ordered by original creation time.',
	now(),
	now()
FROM "topic_collections"
WHERE "topic_collections"."slug" = 'bsv-basics'
ON CONFLICT ("collection_id", "locale") DO NOTHING;
--> statement-breakpoint

INSERT INTO "topic_collection_posts" ("collection_id", "post_id", "sort_order", "created_at")
SELECT
	"topic_collections"."id",
	"ordered_posts"."id",
	"ordered_posts"."position" * 1000,
	now()
FROM "topic_collections"
JOIN (
	SELECT
		"posts"."id",
		row_number() over (order by "posts"."created_at" asc, "posts"."id" asc) as "position"
	FROM "posts"
	INNER JOIN "categories" ON "categories"."id" = "posts"."category_id"
	WHERE
		"categories"."slug" = 'blockchain'
		AND "posts"."deleted_at" IS NULL
) AS "ordered_posts" ON true
WHERE "topic_collections"."slug" = 'bsv-basics'
ON CONFLICT ("collection_id", "post_id") DO NOTHING;
