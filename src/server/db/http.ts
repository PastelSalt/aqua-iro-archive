/** Public endpoints and analytics: single statements / CTEs over Neon's HTTP driver (EXECUTIONPLAN §12.1). */
import { neon, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { DATABASE_URL } from 'astro:env/server';
import * as schema from './schema';
import type { DB } from './types';
import { keeperPreview } from '../dev/preview';

// Retry only when the connection itself could not be opened (the query never reached Neon), so a retry can never
// run a statement twice (after the Kotoha fan site's lib/db.js).
const SAFE_TO_RETRY = new Set(['UND_ERR_CONNECT_TIMEOUT', 'ECONNREFUSED', 'ENOTFOUND', 'EAI_AGAIN']);
neonConfig.fetchFunction = async (url: string, init: RequestInit) => {
  for (let attempt = 1; ; attempt++) {
    try {
      return await fetch(url, init);
    } catch (err) {
      const code = (err as { cause?: { code?: string } })?.cause?.code;
      if (attempt >= 3 || !code || !SAFE_TO_RETRY.has(code)) throw err;
      await new Promise((r) => setTimeout(r, 500 * attempt));
    }
  }
};

// `astro dev` with KEEPER_PREVIEW=1 only (see ../dev/preview.ts); import.meta.env.DEV is false in builds.
const previewDb = import.meta.env.DEV && keeperPreview() ? await import('../dev/preview-db') : null;

let instance: DB | null = null;
export function db(): DB {
  if (previewDb) return previewDb.previewDb() as unknown as DB;
  if (!instance) {
    if (!DATABASE_URL) throw new Error('DATABASE_URL is not set');
    instance = drizzle({ client: neon(DATABASE_URL), schema }) as unknown as DB;
  }
  return instance;
}
