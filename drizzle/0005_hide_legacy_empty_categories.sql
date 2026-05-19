UPDATE "categories"
SET
	"deleted_at" = now(),
	"updated_at" = now()
WHERE "slug" IN ('life', 'projects', 'tech', 'notes')
	AND "deleted_at" IS NULL
	AND NOT EXISTS (
		SELECT 1
		FROM "posts"
		WHERE "posts"."category_id" = "categories"."id"
			AND "posts"."deleted_at" IS NULL
	);
