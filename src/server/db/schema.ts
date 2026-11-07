/** Message Board + admin schema (EXECUTIONPLAN §11.1). */
import { sql } from 'drizzle-orm';
import {
  pgTable,
  pgEnum,
  pgSequence,
  uuid,
  integer,
  text,
  timestamp,
  jsonb,
  bigserial,
  serial,
  index,
  uniqueIndex,
  check,
  date,
  bigint,
  primaryKey,
} from 'drizzle-orm/pg-core';

export const messageStatus = pgEnum('message_status', ['visible', 'held', 'under_review', 'removed']);
export const reportReason = pgEnum('report_reason', [
  'spam',
  'hate',
  'sexual',
  'personal_info',
  'impersonation',
  'other',
]);
export const reportOutcome = pgEnum('report_outcome', ['upheld', 'dismissed']);
export const termKind = pgEnum('term_kind', ['substring', 'word', 'regex']);
export const termAction = pgEnum('term_action', ['hold', 'reject']);
export const adminActionKind = pgEnum('admin_action_kind', [
  'approve',
  'remove',
  'restore',
  'hold',
  'bulk_remove',
  'bulk_approve',
  'settings_change',
  'term_add',
  'term_remove',
  'pause',
  'resume',
  'login',
  'login_failed',
  'twofa_reset',
  'purge',
]);

export const crewNoSeq = pgSequence('crew_no_seq', { startWith: 1, increment: 1, cache: 1 });

export const messages = pgTable(
  'messages',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    crewNo: integer('crew_no')
      .notNull()
      .default(sql`nextval('crew_no_seq')`),
    body: text('body').notNull(), // stored as typed (NFC, cleaned)
    bodyHash: text('body_hash').notNull(), // sha256(compare form) for duplicate checks
    status: messageStatus('status').notNull().default('visible'),
    heldReason: text('held_reason'), // 'term:<id>' | 'raid' | 'newcomer' | 'admin'
    reportCount: integer('report_count').notNull().default(0),
    approvedAt: timestamp('approved_at', { withTimezone: true }),
    removedAt: timestamp('removed_at', { withTimezone: true }),
    removedReason: text('removed_reason'), // free text or 'undo'
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    ipHash: text('ip_hash'), // nulled after 30 days
    ownerTokenHash: text('owner_token_hash'), // nulled after 10 min (cron) — undo window
  },
  (t) => [
    uniqueIndex('messages_crew_no_uq').on(t.crewNo),
    index('messages_status_crew_idx').on(t.status, t.crewNo.desc()),
    index('messages_ip_created_idx').on(t.ipHash, t.createdAt),
    index('messages_hash_created_idx').on(t.bodyHash, t.createdAt),
    check('messages_body_len', sql`char_length(${t.body}) BETWEEN 1 AND 1200`), // grapheme limit (300) enforced in app
  ],
);

export const reports = pgTable(
  'reports',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    messageId: uuid('message_id')
      .notNull()
      .references(() => messages.id, { onDelete: 'cascade' }),
    reason: reportReason('reason').notNull(),
    note: text('note'), // ≤ 200 chars
    reporterHash: text('reporter_hash'), // nulled after 30 days
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    resolvedAt: timestamp('resolved_at', { withTimezone: true }),
    outcome: reportOutcome('outcome'),
  },
  (t) => [
    uniqueIndex('reports_once_per_reporter').on(t.messageId, t.reporterHash),
    index('reports_open_idx').on(t.resolvedAt, t.createdAt),
    index('reports_reporter_created_idx').on(t.reporterHash, t.createdAt),
  ],
);

export const adminActions = pgTable(
  'admin_actions',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    actorId: text('actor_id'), // better-auth user.id
    action: adminActionKind('action').notNull(),
    messageId: uuid('message_id').references(() => messages.id, { onDelete: 'set null' }),
    detail: jsonb('detail').$type<Record<string, unknown>>(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('admin_actions_created_idx').on(t.createdAt.desc())],
);

export const blockedTerms = pgTable(
  'blocked_terms',
  {
    id: serial('id').primaryKey(),
    term: text('term').notNull(),
    kind: termKind('kind').notNull().default('substring'),
    action: termAction('action').notNull().default('hold'),
    note: text('note'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('blocked_terms_term_uq').on(t.term, t.kind)],
);

export const settings = pgTable('settings', {
  key: text('key').primaryKey(),
  value: jsonb('value').notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const appErrors = pgTable('app_errors', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  at: timestamp('at', { withTimezone: true }).notNull().defaultNow(),
  route: text('route').notNull(),
  message: text('message').notNull(),
  stack: text('stack'),
  meta: jsonb('meta'),
});

// Better Auth tables (user, session, account, verification, twoFactor, rateLimit)
export * from './auth-schema';

/**
 * First-party analytics (docs/plans/ANALYTICS-REBUILD-PLAN.md), after moekoworks_official: raw events kept 90 days and
 * read directly by the Keeper; finished days rolled into per-day totals (kept for good) for the long view. No
 * cookies; `visitor_hash` is an HMAC with a random salt that changes every day, and IPs are never stored.
 */
export const analyticsEvents = pgTable(
  'analytics_events',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull().defaultNow(),
    event: text('event').notNull(), // 'page_view', 'page_dwell' or one of the site's track() names
    path: text('path'),
    visitId: text('visit_id').notNull(), // random per tab, never stored in the browser
    visitorHash: text('visitor_hash').notNull(), // hmac(daily salt, ip | user agent), 32 hex
    device: text('device').notNull(),
    browser: text('browser'),
    os: text('os'),
    language: text('language'), // the site language the visitor was reading (ja / en)
    country: text('country'),
    referrerHost: text('referrer_host'),
    durationMs: integer('duration_ms'),
    props: jsonb('props').$type<Record<string, string | number | boolean>>(),
    environment: text('environment').notNull(),
  },
  (t) => [
    index('analytics_events_time_idx').on(t.occurredAt),
    index('analytics_events_event_time_idx').on(t.event, t.occurredAt),
    check('analytics_events_event_check', sql`${t.event} ~ '^[a-z_]{2,30}$'`),
    check('analytics_events_device_check', sql`${t.device} in ('mobile', 'tablet', 'desktop')`),
    check('analytics_events_env_check', sql`${t.environment} in ('production', 'preview', 'development')`),
    check('analytics_events_duration_check', sql`${t.durationMs} is null or ${t.durationMs} >= 0`),
  ],
);

export const analyticsDaily = pgTable(
  'analytics_daily',
  {
    day: date('day').notNull(),
    metric: text('metric').notNull(),
    dimension: text('dimension').notNull().default(''),
    value: bigint('value', { mode: 'number' }).notNull(),
  },
  (t) => [primaryKey({ columns: [t.day, t.metric, t.dimension] })],
);

/** One random salt per local day for the visitor hash; deleted after two days so old hashes can't be rebuilt. */
export const analyticsSalts = pgTable('analytics_salts', {
  day: date('day').primaryKey(),
  salt: text('salt').notNull(), // 64 hex characters
});
