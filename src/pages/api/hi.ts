/**
 * POST /api/hi (docs/plans/ANALYTICS-REBUILD-PLAN.md): the site's own cookieless analytics beacon. A neutral path on
 * purpose: tracker blockers drop requests to paths like /track or /collect before they reach us.
 *
 * Always answers 204 so tracking can never break a page, with an `X-Track` header saying what happened:
 * `ok:<n>; env=<environment>` (n events stored) or `dropped:<reason>`, so DevTools (or the ?debug-analytics console log) shows at
 * once why a visit didn't count. Not counted: bots, browsers signed in to the Keeper, browsers that opted out
 * (Keeper → My account), other sites and floods. The IP is only used for the daily-changing hash.
 */
import type { APIRoute } from 'astro';
import { db } from '../../server/db/http';
import { BOT_UA, insertEvents, localDay, parseBeacon, saltFor, visitorHash } from '../../server/analytics';

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
    return n > MAX_EVENTS_PER_WINDOW;
  }
  b.count += n;
  return b.count > MAX_EVENTS_PER_WINDOW;
}
export type Outcome = 'bot' | 'keeper' | 'optout' | 'origin' | 'body' | 'empty' | 'limit' | 'error';
const answer = (what: string) =>
  new Response(null, { status: 204, headers: { 'Cache-Control': 'no-store', 'X-Track': what } });
const dropped = (why: Outcome) => answer(`dropped:${why}`);
const SITE_HOST = new URL(import.meta.env.SITE ?? 'https://aqua-iro-archive.vercel.app').host;
/**
 * Which traffic this is. Vercel's VERCEL_ENV when the function can see it; otherwise a request to the site's own
 * domain is production (without this fallback, a project that doesn't expose system variables to functions
 * stores every real visit as "development", which the Keeper hides).
 */
export function environmentOf(host: string, vercelEnv = process.env.VERCEL_ENV) {
  if (vercelEnv === 'production' || vercelEnv === 'preview') return vercelEnv;
  return host.split(':')[0] === SITE_HOST ? 'production' : 'development';
}
function sameSite(origin: string | null, host: string) {
  if (!origin) return true; // older browsers omit Origin on same-origin beacons
  try {
    return new URL(origin).host === host;
  } catch {
    return false; // "null" (sandboxed frames, file://) or junk
  }
}

export const POST: APIRoute = async ({ request, clientAddress }) => {
  try {
    const ua = request.headers.get('user-agent') ?? '';
    const cookies = request.headers.get('cookie') ?? '';
    const host = request.headers.get('x-forwarded-host') ?? request.headers.get('host') ?? '';
    const env = environmentOf(host);
    if (!ua || BOT_UA.test(ua)) return dropped('bot');
    // signed in to the Keeper (better-auth session cookie, with or without the __Secure- prefix)
    if (/aia-keeper\.session_token=/.test(cookies)) return dropped('keeper');
    if (!sameSite(request.headers.get('origin'), host)) return dropped('origin');
    const text = await request.text();
    if (text.length > 16 * 1024) return dropped('body');
    let body: unknown;
    try {
      body = JSON.parse(text);
    } catch {
      return dropped('body');
    }
    if ((body as { nt?: unknown } | null)?.nt === 1) return dropped('optout');
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || clientAddress || '';
    const d = db();
    const vh = visitorHash(await saltFor(d, localDay()), ip, ua);
    const list = parseBeacon(body, {
      ua,
      visitorHash: vh,
      country: request.headers.get('x-vercel-ip-country'),
      environment: env,
      ownHost: host.split(':')[0] ?? '',
    });
    if (!list.length) return answer(`dropped:empty; env=${env}`);
    if (overLimit(vh, list.length)) return dropped('limit');
    await insertEvents(d, list);
    return answer(`ok:${list.length}; env=${env}`);
  } catch (e) {
    console.error('[hi] error:', e);
    return dropped('error');
  }
};
