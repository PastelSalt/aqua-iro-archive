CREATE TYPE "public"."admin_action_kind" AS ENUM('approve', 'remove', 'restore', 'hold', 'bulk_remove', 'bulk_approve', 'settings_change', 'term_add', 'term_remove', 'pause', 'resume', 'login', 'login_failed', 'twofa_reset', 'purge');--> statement-breakpoint
CREATE TYPE "public"."message_status" AS ENUM('visible', 'held', 'under_review', 'removed');--> statement-breakpoint
CREATE TYPE "public"."report_outcome" AS ENUM('upheld', 'dismissed');--> statement-breakpoint
CREATE TYPE "public"."report_reason" AS ENUM('spam', 'hate', 'sexual', 'personal_info', 'impersonation', 'other');--> statement-breakpoint
CREATE TYPE "public"."term_action" AS ENUM('hold', 'reject');--> statement-breakpoint
CREATE TYPE "public"."term_kind" AS ENUM('substring', 'word', 'regex');--> statement-breakpoint
CREATE SEQUENCE "public"."crew_no_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1;--> statement-breakpoint
CREATE TABLE "admin_actions" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"actor_id" text,
	"action" "admin_action_kind" NOT NULL,
	"message_id" uuid,
	"detail" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app_errors" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"at" timestamp with time zone DEFAULT now() NOT NULL,
	"route" text NOT NULL,
	"message" text NOT NULL,
	"stack" text,
	"meta" jsonb
);
--> statement-breakpoint
CREATE TABLE "blocked_terms" (
	"id" serial PRIMARY KEY NOT NULL,
	"term" text NOT NULL,
	"kind" "term_kind" DEFAULT 'substring' NOT NULL,
	"action" "term_action" DEFAULT 'hold' NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"crew_no" integer DEFAULT nextval('crew_no_seq') NOT NULL,
	"body" text NOT NULL,
	"body_hash" text NOT NULL,
	"status" "message_status" DEFAULT 'visible' NOT NULL,
	"held_reason" text,
	"report_count" integer DEFAULT 0 NOT NULL,
	"approved_at" timestamp with time zone,
	"removed_at" timestamp with time zone,
	"removed_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ip_hash" text,
	"owner_token_hash" text,
	CONSTRAINT "messages_body_len" CHECK (char_length("messages"."body") BETWEEN 1 AND 1200)
);
--> statement-breakpoint
CREATE TABLE "reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"message_id" uuid NOT NULL,
	"reason" "report_reason" NOT NULL,
	"note" text,
	"reporter_hash" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"resolved_at" timestamp with time zone,
	"outcome" "report_outcome"
);
--> statement-breakpoint
CREATE TABLE "settings" (
	"key" text PRIMARY KEY NOT NULL,
	"value" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "account" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp with time zone,
	"refresh_token_expires_at" timestamp with time zone,
	"scope" text,
	"password" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rate_limit" (
	"id" text PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"count" integer NOT NULL,
	"last_request" bigint NOT NULL,
	CONSTRAINT "rate_limit_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "two_factor" (
	"id" text PRIMARY KEY NOT NULL,
	"secret" text NOT NULL,
	"backup_codes" text NOT NULL,
	"user_id" text NOT NULL,
	"verified" boolean DEFAULT true,
	"failed_verification_count" integer DEFAULT 0,
	"locked_until" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"two_factor_enabled" boolean DEFAULT false,
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "admin_actions" ADD CONSTRAINT "admin_actions_message_id_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."messages"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_message_id_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."messages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "two_factor" ADD CONSTRAINT "two_factor_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "admin_actions_created_idx" ON "admin_actions" USING btree ("created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE UNIQUE INDEX "blocked_terms_term_uq" ON "blocked_terms" USING btree ("term","kind");--> statement-breakpoint
CREATE UNIQUE INDEX "messages_crew_no_uq" ON "messages" USING btree ("crew_no");--> statement-breakpoint
CREATE INDEX "messages_status_crew_idx" ON "messages" USING btree ("status","crew_no" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "messages_ip_created_idx" ON "messages" USING btree ("ip_hash","created_at");--> statement-breakpoint
CREATE INDEX "messages_hash_created_idx" ON "messages" USING btree ("body_hash","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "reports_once_per_reporter" ON "reports" USING btree ("message_id","reporter_hash");--> statement-breakpoint
CREATE INDEX "reports_open_idx" ON "reports" USING btree ("resolved_at","created_at");--> statement-breakpoint
CREATE INDEX "reports_reporter_created_idx" ON "reports" USING btree ("reporter_hash","created_at");--> statement-breakpoint
CREATE INDEX "account_user_idx" ON "account" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "session_user_idx" ON "session" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "two_factor_secret_idx" ON "two_factor" USING btree ("secret");--> statement-breakpoint
CREATE INDEX "two_factor_user_idx" ON "two_factor" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "verification_identifier_idx" ON "verification" USING btree ("identifier");