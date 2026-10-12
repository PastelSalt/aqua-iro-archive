/** Auth + admin: interactive transactions over Neon's WebSocket Pool (EXECUTIONPLAN §12.1). */
import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from 'ws';
import { DATABASE_URL } from 'astro:env/server';
import * as schema from './schema';

neonConfig.webSocketConstructor = ws;
let pool: Pool | null = null;
export function dbTx() {
  if (!DATABASE_URL) throw new Error('DATABASE_URL is not set');
  pool ??= new Pool({ connectionString: DATABASE_URL });
  return drizzle({ client: pool, schema });
}
