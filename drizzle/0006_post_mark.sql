ALTER TABLE "posts" ADD COLUMN IF NOT EXISTS "mark" varchar(20) NOT NULL DEFAULT '';--> statement-breakpoint

UPDATE "posts"
SET "mark" = CASE
	WHEN coalesce("pinned", false) THEN 'pinned'
	WHEN coalesce("featured", false) THEN 'featured'
	ELSE ''
END
WHERE coalesce("mark", '') = '';
