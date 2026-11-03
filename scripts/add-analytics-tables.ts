/**
 * One-time production step for docs/ANALYTICS-PLAN.md: creates analytics_events and analytics_daily (and their
 * indexes) if they don't exist yet, from db/migrations/0001_own_analytics.sql. Touches nothing else and is safe
 * to run again. Reads .env.production.local:  npm run db:add-analytics
 */
import { readFileSync } from 'node:fs';
import { scriptDb, loadProdEnv } from './lib/standalone-auth.ts';

loadProdEnv();
const { pool } = scriptDb();
const statements = readFileSync('db/migrations/0001_own_analytics.sql', 'utf8')
  .split('--> statement-breakpoint')
  .map((s) => s.trim())
  .filter(Boolean)
  .map((s) =>
    s
      .replace(/^CREATE TABLE "/, 'CREATE TABLE IF NOT EXISTS "')
      .replace(/^CREATE INDEX "/, 'CREATE INDEX IF NOT EXISTS "'),
  );
for (const s of statements) await pool.query(s);
const { rows } = await pool.query(
  `select table_name from information_schema.tables where table_name in ('analytics_events', 'analytics_daily') order by 1`,
);
console.log(`✓ Tables present: ${rows.map((r: { table_name: string }) => r.table_name).join(', ')}`);
await pool.end();
