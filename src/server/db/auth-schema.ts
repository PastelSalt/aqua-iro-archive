/**
 * Better Auth tables (better-auth 1.7 + twoFactor plugin + database rate-limit storage).
 * Field list printed from @better-auth/core getAuthTables() on 2026-10-12 (scripts/dev/print-auth-tables.mts);
 * JS keys must match Better Auth's field names, SQL names are snake_case.
 */
import { bigint, boolean, index, integer, pgTable, text, timestamp } from 'drizzle-orm/pg-core';

const tz = { withTimezone: true } as const;

export const user = pgTable('user', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  emailVerified: boolean('email_verified').notNull().default(false),
  image: text('image'),
  createdAt: timestamp('created_at', tz).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', tz).notNull().defaultNow(),
  twoFactorEnabled: boolean('two_factor_enabled').default(false),
});

export const session = pgTable(
  'session',
  {
    id: text('id').primaryKey(),
    expiresAt: timestamp('expires_at', tz).notNull(),
    token: text('token').notNull().unique(),
    createdAt: timestamp('created_at', tz).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', tz).notNull(),
    ipAddress: text('ip_address'),
    userAgent: text('user_agent'),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
  },
  (t) => [index('session_user_idx').on(t.userId)],
);

export const account = pgTable(
  'account',
  {
    id: text('id').primaryKey(),
    accountId: text('account_id').notNull(),
    providerId: text('provider_id').notNull(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    accessToken: text('access_token'),
    refreshToken: text('refresh_token'),
    idToken: text('id_token'),
    accessTokenExpiresAt: timestamp('access_token_expires_at', tz),
    refreshTokenExpiresAt: timestamp('refresh_token_expires_at', tz),
    scope: text('scope'),
    password: text('password'),
    createdAt: timestamp('created_at', tz).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', tz).notNull(),
  },
  (t) => [index('account_user_idx').on(t.userId)],
);

export const verification = pgTable(
  'verification',
  {
    id: text('id').primaryKey(),
    identifier: text('identifier').notNull(),
    value: text('value').notNull(),
    expiresAt: timestamp('expires_at', tz).notNull(),
    createdAt: timestamp('created_at', tz).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', tz).notNull().defaultNow(),
  },
  (t) => [index('verification_identifier_idx').on(t.identifier)],
);

export const twoFactor = pgTable(
  'two_factor',
  {
    id: text('id').primaryKey(),
    secret: text('secret').notNull(),
    backupCodes: text('backup_codes').notNull(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    verified: boolean('verified').default(true),
    failedVerificationCount: integer('failed_verification_count').default(0),
    lockedUntil: timestamp('locked_until', tz),
  },
  (t) => [index('two_factor_secret_idx').on(t.secret), index('two_factor_user_idx').on(t.userId)],
);

export const rateLimit = pgTable('rate_limit', {
  id: text('id').primaryKey(),
  key: text('key').notNull().unique(),
  count: integer('count').notNull(),
  lastRequest: bigint('last_request', { mode: 'number' }).notNull(),
});
