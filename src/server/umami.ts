/**
 * Umami API client for /keeper (EXECUTIONPLAN §15.4). With UMAMI_API_KEY: a self-hosted Umami v3 key
 * (umami_…) goes as a Bearer token; an Umami Cloud key (UMAMI_API_URL=https://api.umami.is/v1) as the
 * x-umami-api-key header. Without one: a self-hosted user and password (token cached 12 h).
 * Responses cached 5 min per range.
 * Endpoint shapes are isolated here so a version change touches one file — verify paths against the installed
 * Umami version when it is deployed (Umami v3: metrics type `path` instead of v2's `url`).
 */
import { UMAMI_API_URL, UMAMI_API_KEY, UMAMI_API_USER, UMAMI_API_PASSWORD } from 'astro:env/server';
import { PUBLIC_UMAMI_WEBSITE_ID } from 'astro:env/client';

let token: { value: string; at: number } | null = null;
const cache = new Map<string, { at: number; data: unknown }>();

export function umamiConfigured(): boolean {
  return !!(
    UMAMI_API_URL &&
    PUBLIC_UMAMI_WEBSITE_ID &&
    (UMAMI_API_KEY || (UMAMI_API_USER && UMAMI_API_PASSWORD))
  );
}

async function authHeaders(): Promise<Record<string, string>> {
  if (UMAMI_API_KEY)
    return UMAMI_API_KEY.startsWith('umami_')
      ? { Authorization: `Bearer ${UMAMI_API_KEY}` }
      : { 'x-umami-api-key': UMAMI_API_KEY };
  return { Authorization: `Bearer ${await login()}` };
}

async function login(): Promise<string> {
  if (token && Date.now() - token.at < 12 * 3600_000) return token.value;
  const r = await fetch(`${UMAMI_API_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: UMAMI_API_USER, password: UMAMI_API_PASSWORD }),
    signal: AbortSignal.timeout(6000),
  });
  if (!r.ok) throw new Error(`umami login ${r.status}`);
  token = { value: ((await r.json()) as { token: string }).token, at: Date.now() };
  return token.value;
}

async function get<T>(path: string, params: Record<string, string | number>, retry = true): Promise<T> {
  const key = `${path}?${new URLSearchParams(params as Record<string, string>)}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < 5 * 60_000) return hit.data as T;
  const r = await fetch(`${UMAMI_API_URL}/websites/${PUBLIC_UMAMI_WEBSITE_ID}${key}`, {
    headers: { Accept: 'application/json', ...(await authHeaders()) },
    signal: AbortSignal.timeout(8000),
  });
  if (r.status === 401 && retry && !UMAMI_API_KEY) {
    token = null;
    return get(path, params, false);
  }
  if (!r.ok) throw new Error(`umami ${path} ${r.status}`);
  const data = (await r.json()) as T;
  cache.set(key, { at: Date.now(), data });
  return data;
}

export type Range = { startAt: number; endAt: number };
const TZ = 'Asia/Manila'; // the keeper's time zone (src/lib/keeper-format.ts); UTC+8, no daylight saving
const TZ_MS = 8 * 3600_000;
export const RANGE_DAYS = { '24h': 1, '7d': 7, '30d': 30, '90d': 90, '1y': 365 } as const;
export type RangeId = keyof typeof RANGE_DAYS;

/** The last N days up to now, rounded to 5 minutes so repeated loads share the 5-minute cache. */
export function rangeFor(id: string): Range {
  const endAt = Math.ceil(Date.now() / 300_000) * 300_000;
  const days = RANGE_DAYS[id as RangeId] ?? 7;
  return { startAt: endAt - days * 86400_000, endAt };
}
/** Today / this week (from Monday) / this month, in the keeper's time zone. */
function periodStart(kind: 'today' | 'week' | 'month'): number {
  const local = new Date(Date.now() + TZ_MS);
  const y = local.getUTCFullYear();
  const m = local.getUTCMonth();
  const d = local.getUTCDate();
  const day = kind === 'month' ? 1 : kind === 'week' ? d - ((local.getUTCDay() + 6) % 7) : d;
  return Date.UTC(y, m, day) - TZ_MS;
}

/** Umami v2 returns { value, prev } per stat; v3 returns plain numbers plus a `comparison` object. */
type StatsRaw = Record<string, unknown> & { comparison?: Record<string, unknown> };
const pick = (v: unknown): number | null =>
  typeof v === 'number'
    ? v
    : v && typeof (v as { value?: unknown }).value === 'number'
      ? (v as { value: number }).value
      : null;
const prevOf = (raw: StatsRaw, k: string): number | null => {
  const c = raw.comparison?.[k];
  if (typeof c === 'number') return c;
  const v = raw[k] as { prev?: unknown } | undefined;
  return typeof v?.prev === 'number' ? v.prev : null;
};
export type Stats = Record<'visitors' | 'visits' | 'pageviews' | 'bounces' | 'totaltime', number> & {
  prev: Record<'visitors' | 'visits' | 'pageviews' | 'bounces' | 'totaltime', number | null>;
};
const STAT_KEYS = ['visitors', 'visits', 'pageviews', 'bounces', 'totaltime'] as const;
async function stats(range: Range): Promise<Stats> {
  const raw = await get<StatsRaw>('/stats', { ...range, timezone: TZ });
  const out = { prev: {} } as Stats;
  for (const k of STAT_KEYS) {
    out[k] = pick(raw[k]) ?? 0;
    out.prev[k] = prevOf(raw, k);
  }
  return out;
}
export type Metric = { x: string; y: number };
const metric = (range: Range, type: string, limit: number) =>
  get<Metric[]>('/metrics', { ...range, timezone: TZ, type, limit }).catch(() => [] as Metric[]);

/** Dashboard + Visitors page data. `full` adds OS, language, screen, 25 rows per list and the 7 × 24 grid. */
export async function visitors(rangeId: string, unit: 'day' | 'week' | 'month', full: boolean) {
  const range = rangeFor(rangeId);
  // a chart needs enough points: weekly/monthly bars look back further than the range
  const seriesRange =
    unit === 'month'
      ? { startAt: range.endAt - 365 * 86400_000, endAt: range.endAt }
      : unit === 'week'
        ? { startAt: range.endAt - 12 * 7 * 86400_000, endAt: range.endAt }
        : rangeId === '24h'
          ? { startAt: range.endAt - 7 * 86400_000, endAt: range.endAt }
          : range;
  const limit = full ? 25 : 8;
  const now = Math.ceil(Date.now() / 300_000) * 300_000;
  const [inRange, today, week, month, series, paths, referrers, countries, devices, browsers] =
    await Promise.all([
      stats(range),
      stats({ startAt: periodStart('today'), endAt: now }),
      stats({ startAt: periodStart('week'), endAt: now }),
      stats({ startAt: periodStart('month'), endAt: now }),
      get<{ pageviews: Metric[]; sessions: Metric[] }>('/pageviews', { ...seriesRange, timezone: TZ, unit }),
      metric(range, 'path', limit).then((r) => (r.length ? r : metric(range, 'url', limit))),
      metric(range, 'referrer', limit),
      metric(range, 'country', limit),
      metric(range, 'device', limit),
      metric(range, 'browser', limit),
    ]);
  const extra = full
    ? await Promise.all([
        metric(range, 'os', limit),
        metric(range, 'language', limit),
        metric(range, 'screen', limit),
        get<number[][]>('/sessions/weekly', { ...range, timezone: TZ }).catch(() => null),
      ])
    : null;
  return {
    stats: inRange,
    periods: { today, week, month },
    unit,
    series,
    paths,
    referrers,
    countries,
    devices,
    browsers,
    os: extra?.[0] ?? [],
    languages: extra?.[1] ?? [],
    screens: extra?.[2] ?? [],
    weekly: extra?.[3] ?? null,
    fetchedAt: Date.now(),
  };
}

/** Visitors on the site in the last 5 minutes (Umami "active"; v2 returns { x }, v3 { visitors }). */
export async function activeNow(): Promise<number | null> {
  if (!umamiConfigured()) return null;
  const r = await fetch(`${UMAMI_API_URL}/websites/${PUBLIC_UMAMI_WEBSITE_ID}/active`, {
    headers: { Accept: 'application/json', ...(await authHeaders()) },
    signal: AbortSignal.timeout(5000),
  }).catch(() => null);
  if (!r?.ok) return null;
  const j = (await r.json()) as { visitors?: number; x?: number };
  return j.visitors ?? j.x ?? null;
}

export async function eventProperty(range: Range, event: string, property: string) {
  return get<{ value: string; total: number }[]>('/event-data/values', {
    ...range,
    event,
    propertyName: property,
  }).catch(() => []);
}

/** Daily digest (cron): unique visitors in the last 24 h. */
export async function umamiVisitors24h(): Promise<number | null> {
  if (!umamiConfigured()) return null;
  return (await stats(rangeFor('24h'))).visitors;
}

/** How many times each custom event fired in the range (Umami metrics type "event"). */
export const eventCounts = (rangeId: string) => metric(rangeFor(rangeId), 'event', 100);
