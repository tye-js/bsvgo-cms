ALTER TABLE "posts" ADD COLUMN IF NOT EXISTS "ai_author_role" varchar(80);--> statement-breakpoint
ALTER TABLE "posts" ADD COLUMN IF NOT EXISTS "ai_author_zh_name" varchar(120);--> statement-breakpoint
ALTER TABLE "posts" ADD COLUMN IF NOT EXISTS "ai_author_en_name" varchar(120);--> statement-breakpoint
ALTER TABLE "posts" ADD COLUMN IF NOT EXISTS "ai_author_avatar" text;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "posts_ai_author_role_idx" ON "posts" USING btree ("ai_author_role");--> statement-breakpoint
