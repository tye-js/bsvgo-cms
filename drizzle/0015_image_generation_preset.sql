INSERT INTO "app_settings" ("key", "value", "encrypted")
VALUES ('ai.image.preset', 'custom', false)
ON CONFLICT ("key") DO NOTHING;
--> statement-breakpoint
