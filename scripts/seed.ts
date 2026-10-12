/** Apply db/seed/*.sql to DATABASE_URL_UNPOOLED (idempotent). */
import { readFileSync, readdirSync } from 'node:fs';
import { neon } from '@neondatabase/serverless';

const url = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;
if (!url) throw new Error('Set DATABASE_URL_UNPOOLED');
const sql = neon(url);
for (const f of readdirSync('db/seed')
  .filter((x) => x.endsWith('.sql'))
  .sort()) {
  const text = readFileSync(`db/seed/${f}`, 'utf8');
  await sql.query(text);
  console.log(`seeded ${f}`);
}
