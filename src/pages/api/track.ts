/**
 * POST /api/track (docs/ANALYTICS-PLAN.md), after the Kotoha fan site's api/track.js: the site's own cookieless
 * analytics beacon. Always answers 204 so tracking can never break a page; bad events are dropped. Bots,
 * signed-in keepers, other sites and floods are ignored. The IP is only used for the daily-changing hash.
 */
import type { APIRoute } from 'astro';
import { ANALYTICS_SALT } from 'astro:env/server';
import { dbTx } from '../../server/db/pool';
import { BOT_UA, insertEvents, parseBeacon, rollupIfStale, visitorHash } from '../../server/analytics';

export const prerender = false;

const WINDOW_MS = 5 * 60_000;
const MAX_EVENTS_PER_WINDOW = 200; // per visitor per function instance (best effort)
const buckets = new Map<string, { start: number; count: number }>();
function overLimit(key: string, n: number) {
  const now = Date.now();
  if (buckets.size > 5000) for (const [k, b] of buckets) if (now - b.start > WINDOW_MS) buckets.delete(k);
  const b = buckets.get(key);
  if (!b || now - b.start > WINDOW_MS) {
    buckets.set(key, { start: now, count: n });
    return false;
  }
  b.count += n;
  return b.count > MAX_EVENTS_PER_WINDOW;
}
const done = () => new Response(null, { status: 204, headers: { 'Cache-Control': 'no-store' } });
const environment = () => {
  const v = process.env.VERCEL_ENV;
  return v === 'production' || v === 'preview' ? v : 'development';
};

export const POST: APIRoute = async ({ request, clientAddress }) => {
  try {
    const ua = request.headers.get('user-agent') ?? '';
    const cookies = request.headers.get('cookie') ?? '';
    const host = request.headers.get('x-forwarded-host') ?? request.headers.get('host') ?? '';
    const origin = request.headers.get('origin');
    // bots, signed-in keepers (better-auth session cookie) and other sites are not counted
    if (!ua || BOT_UA.test(ua) || /aia-keeper\.session_token=/.test(cookies)) return done();
    if (origin && new URL(origin).host !== host) return done();
    const env = environment();
    const salt = ANALYTICS_SALT ?? (env === 'production' ? null : 'dev-salt');
    if (!salt) return done(); // not configured yet: drop quietly rather than count unsalted
    const text = await request.text();
    if (text.length > 16 * 1024) return done();
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || clientAddress || '';
    const vh = visitorHash(salt, ip, ua);
    const list = parseBeacon(JSON.parse(text), {
      ua,
      visitorHash: vh,
      country: request.headers.get('x-vercel-ip-country'),
      environment: env,
      ownHost: host.split(':')[0] ?? '',
    });
    if (!list.length || overLimit(vh, list.length)) return done();
    const db = dbTx() as never;
    await insertEvents(db, list);
    // roll finished days into daily totals (once per instance per day; a no-op otherwise)
    await rollupIfStale(db).catch((e) => console.error('[track] rollup failed:', e));
    return done();
  } catch (e) {
    if (!(e instanceof SyntaxError)) console.error('[track] error:', e);
    return done();
  }
};
