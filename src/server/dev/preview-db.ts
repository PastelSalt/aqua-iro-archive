/** Keeper preview only (see ./preview.ts): drizzle over the local PGlite folder made by keeper-preview-db.mts. */
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import * as schema from '../db/schema';

let db: ReturnType<typeof drizzle<typeof schema>> | null = null;
export function previewDb() {
  db ??= drizzle(new PGlite('.keeper-preview'), { schema });
  return db;
}
