CREATE TABLE "analytics_daily" (
	"day" date NOT NULL,
	"metric" text NOT NULL,
	"dimension" text DEFAULT '' NOT NULL,
	"value" bigint NOT NULL,
	CONSTRAINT "analytics_daily_day_metric_dimension_pk" PRIMARY KEY("day","metric","dimension")
);
--> statement-breakpoint
CREATE TABLE "analytics_events" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	"event" text NOT NULL,
	"path" text,
	"visit_id" text NOT NULL,
	"visitor_hash" text NOT NULL,
	"device" text,
	"browser" text,
	"os" text,
	"language" text,
	"country" text,
	"referrer_host" text,
	"duration_ms" integer,
	"props" jsonb,
	"environment" text NOT NULL
);
--> statement-breakpoint
CREATE INDEX "analytics_events_time_idx" ON "analytics_events" USING btree ("occurred_at");--> statement-breakpoint
CREATE INDEX "analytics_events_event_time_idx" ON "analytics_events" USING btree ("event","occurred_at");