/** Auth + admin: interactive transactions over Neon's WebSocket Pool (EXECUTIONPLAN §12.1). */
import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from 'ws';
import { DATABASE_URL } from 'astro:env/server';
import * as schema from './schema';
import { keeperPreview } from '../dev/preview';

neonConfig.webSocketConstructor = ws;
let pool: Pool | null = null;

// `astro dev` with KEEPER_PREVIEW=1 only: the local PGlite database from scripts/dev/keeper-preview-db.mts.
// import.meta.env.DEV is false in builds, so this branch and its import never reach production.
const previewDb = import.meta.env.DEV && keeperPreview() ? await import('../dev/preview-db') : null;

export function dbTx() {
  if (previewDb) return previewDb.previewDb() as unknown as ReturnType<typeof drizzle<typeof schema>>;
  if (!DATABASE_URL) throw new Error('DATABASE_URL is not set');
  pool ??= new Pool({ connectionString: DATABASE_URL });
  return drizzle({ client: pool, schema });
}
