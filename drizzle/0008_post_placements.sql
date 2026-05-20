CREATE TABLE IF NOT EXISTS "post_placements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"post_id" uuid NOT NULL,
	"category_id" uuid,
	"scope" varchar(40) NOT NULL,
	"slot" varchar(40) NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"starts_at" timestamp,
	"ends_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "post_placements" ADD CONSTRAINT "post_placements_post_id_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "post_placements" ADD CONSTRAINT "post_placements_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "post_placements_post_idx" ON "post_placements" USING btree ("post_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "post_placements_scope_slot_idx" ON "post_placements" USING btree ("scope","slot");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "post_placements_category_slot_idx" ON "post_placements" USING btree ("category_id","slot");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "post_placements_unique" ON "post_placements" USING btree ("post_id","scope","slot","category_id");--> statement-breakpoint
INSERT INTO "post_placements" ("post_id", "category_id", "scope", "slot", "sort_order", "enabled", "created_at", "updated_at")
SELECT "id", NULL, 'home', 'featured', "sort_order", true, now(), now()
FROM "posts"
WHERE coalesce("pinned", false) = true
ON CONFLICT DO NOTHING;
--> statement-breakpoint
INSERT INTO "post_placements" ("post_id", "category_id", "scope", "slot", "sort_order", "enabled", "created_at", "updated_at")
SELECT "id", "category_id", 'category', 'featured', "sort_order", true, now(), now()
FROM "posts"
WHERE coalesce("featured", false) = true
ON CONFLICT DO NOTHING;
--> statement-breakpoint
INSERT INTO "post_placements" ("post_id", "category_id", "scope", "slot", "sort_order", "enabled", "created_at", "updated_at")
SELECT "id", NULL, 'home', 'promoted', "sort_order", true, now(), now()
FROM "posts"
WHERE coalesce("mark", '') = 'sponsored'
ON CONFLICT DO NOTHING;
--> statement-breakpoint
INSERT INTO "post_placements" ("post_id", "category_id", "scope", "slot", "sort_order", "enabled", "created_at", "updated_at")
SELECT "id", "category_id", 'category', 'promoted', "sort_order", true, now(), now()
FROM "posts"
WHERE coalesce("mark", '') = 'sponsored'
ON CONFLICT DO NOTHING;
