ALTER TABLE "ai_jobs" DROP CONSTRAINT IF EXISTS "ai_jobs_type_check";--> statement-breakpoint
ALTER TABLE "ai_jobs" ADD CONSTRAINT "ai_jobs_type_check" CHECK ("ai_jobs"."type" in ('post_draft_rewrite', 'post_draft_translate', 'post_draft_metadata', 'media_metadata', 'bulk_post_seo', 'bulk_post_cover_images'));
