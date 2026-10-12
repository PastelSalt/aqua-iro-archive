/** In-process Postgres (PGlite) with the real migrations + seeds applied — stands in for a Neon branch. */
import { readFileSync, readdirSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import * as schema from '../../src/server/db/schema';
import type { DB } from '../../src/server/db/types';
import type { BoardDeps } from '../../src/server/board/types';
import { _resetSettingsCache } from '../../src/server/settings';
import { _resetTermsCache } from '../../src/server/board/filter';

export async function freshDb(): Promise<{ db: DB; pg: PGlite }> {
  const pg = new PGlite();
  for (const f of readdirSync('db/migrations')
    .filter((x) => x.endsWith('.sql'))
    .sort()) {
    for (const stmt of readFileSync(`db/migrations/${f}`, 'utf8').split('--> statement-breakpoint'))
      if (stmt.trim()) await pg.exec(stmt);
  }
  for (const f of readdirSync('db/seed')
    .filter((x) => x.endsWith('.sql'))
    .sort())
    await pg.exec(readFileSync(`db/seed/${f}`, 'utf8'));
  _resetSettingsCache();
  _resetTermsCache();
  return { db: drizzle(pg, { schema }) as unknown as DB, pg };
}

/** Turnstile stub: tokens starting with "ok" pass. */
export const turnstileStub: typeof fetch = async (_url, init) => {
  const body = new URLSearchParams(String((init as RequestInit).body));
  const ok = body.get('response')?.startsWith('ok') ?? false;
  return new Response(
    JSON.stringify({
      success: ok,
      hostname: 'aqua-iro-archive.vercel.app',
      'error-codes': ok ? [] : ['invalid-input-response'],
    }),
  );
};

export function deps(db: DB, ip = '203.0.113.7'): BoardDeps {
  return {
    db,
    ipSecret: 'test-secret',
    turnstileSecret: 'real-secret',
    hostnames: ['aqua-iro-archive.vercel.app'],
    clientIp: ip,
    siteUrl: 'https://aqua-iro-archive.vercel.app',
    fetchImpl: turnstileStub,
  };
}
