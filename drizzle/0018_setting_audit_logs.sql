CREATE TABLE IF NOT EXISTS "app_setting_audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"setting_key" varchar(120) NOT NULL,
	"old_value_summary" text DEFAULT '' NOT NULL,
	"new_value_summary" text DEFAULT '' NOT NULL,
	"changed_by" uuid REFERENCES "users"("id") ON DELETE SET NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "app_setting_audit_logs_setting_created_at_idx" ON "app_setting_audit_logs" USING btree ("setting_key","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "app_setting_audit_logs_changed_by_created_at_idx" ON "app_setting_audit_logs" USING btree ("changed_by","created_at");
