CREATE TABLE IF NOT EXISTS "ai_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"type" varchar(80) NOT NULL,
	"status" varchar(20) DEFAULT 'queued' NOT NULL,
	"input" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"output" jsonb,
	"error_message" text,
	"attempts" integer DEFAULT 0 NOT NULL,
	"max_attempts" integer DEFAULT 1 NOT NULL,
	"created_by" uuid REFERENCES "users"("id") ON DELETE SET NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"started_at" timestamp,
	"finished_at" timestamp,
	CONSTRAINT "ai_jobs_type_check" CHECK ("ai_jobs"."type" in ('post_draft_rewrite', 'post_draft_translate', 'post_draft_metadata', 'media_metadata', 'bulk_post_seo')),
	CONSTRAINT "ai_jobs_status_check" CHECK ("ai_jobs"."status" in ('queued', 'running', 'succeeded', 'failed'))
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ai_jobs_status_created_at_idx" ON "ai_jobs" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ai_jobs_created_by_created_at_idx" ON "ai_jobs" USING btree ("created_by","created_at");
