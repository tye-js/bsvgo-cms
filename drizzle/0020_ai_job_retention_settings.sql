INSERT INTO "app_settings" ("key", "value", "encrypted")
VALUES
  ('ai.jobs.retention.succeeded_single_days', '7', false),
  ('ai.jobs.retention.succeeded_bulk_days', '10', false),
  ('ai.jobs.retention.failed_days', '10', false),
  ('ai.jobs.default_recent_days', '7', false)
ON CONFLICT ("key") DO NOTHING;
