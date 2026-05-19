CREATE TABLE IF NOT EXISTS "analytics_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_name" varchar(80) NOT NULL,
	"visitor_id" varchar(160) NOT NULL,
	"session_id" varchar(160) NOT NULL,
	"locale" varchar(10),
	"path" text,
	"referrer" text,
	"href" text,
	"label" text,
	"target_type" varchar(80),
	"section" varchar(160),
	"article_slug" varchar(255),
	"category_slug" varchar(140),
	"tag_slug" varchar(140),
	"value" integer,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "analytics_events_created_at_idx" ON "analytics_events" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "analytics_events_event_created_at_idx" ON "analytics_events" USING btree ("event_name", "created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "analytics_events_visitor_idx" ON "analytics_events" USING btree ("visitor_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "analytics_events_session_idx" ON "analytics_events" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "analytics_events_article_idx" ON "analytics_events" USING btree ("article_slug");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "analytics_events_category_idx" ON "analytics_events" USING btree ("category_slug");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "analytics_events_tag_idx" ON "analytics_events" USING btree ("tag_slug");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "analytics_events_referrer_idx" ON "analytics_events" USING btree ("referrer");
