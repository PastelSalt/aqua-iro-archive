/** Any Drizzle Postgres database (neon-http in production, neon-serverless Pool for transactions, PGlite in tests). */
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';
import type * as schema from './schema';

export type DB = PgDatabase<PgQueryResultHKT, typeof schema>;

/** Normalize `db.execute()` results across drivers (neon-http, node-postgres, PGlite all expose `.rows`). */
export function rows<T>(r: unknown): T[] {
  if (Array.isArray(r)) return r as T[];
  return ((r as { rows?: T[] }).rows ?? []) as T[];
}
