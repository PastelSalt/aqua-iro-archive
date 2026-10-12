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
