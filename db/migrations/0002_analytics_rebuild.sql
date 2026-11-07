-- Analytics rebuild (docs/ANALYTICS-REBUILD-PLAN.md): start clean; the old rows were counted under the previous rules.
TRUNCATE "analytics_events", "analytics_daily";--> statement-breakpoint
CREATE TABLE "analytics_salts" (
	"day" date PRIMARY KEY NOT NULL,
	"salt" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "analytics_events" ALTER COLUMN "device" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "analytics_events" ADD CONSTRAINT "analytics_events_event_check" CHECK ("analytics_events"."event" ~ '^[a-z_]{2,30}$');--> statement-breakpoint
ALTER TABLE "analytics_events" ADD CONSTRAINT "analytics_events_device_check" CHECK ("analytics_events"."device" in ('mobile', 'tablet', 'desktop'));--> statement-breakpoint
ALTER TABLE "analytics_events" ADD CONSTRAINT "analytics_events_env_check" CHECK ("analytics_events"."environment" in ('production', 'preview', 'development'));--> statement-breakpoint
ALTER TABLE "analytics_events" ADD CONSTRAINT "analytics_events_duration_check" CHECK ("analytics_events"."duration_ms" is null or "analytics_events"."duration_ms" >= 0);