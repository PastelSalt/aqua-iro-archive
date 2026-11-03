/**
 * First-party, cookieless analytics (docs/ANALYTICS-PLAN.md), ported from the Kotoha fan site's lib/analytics.js:
 * beacon checks, a daily-salted visitor hash, one aggregate query, lazy per-day roll-ups, and the numbers the
 * Keeper shows (the same shapes the old Umami client returned, so the Keeper pages didn't change).
 * Days are the keeper's time zone (Asia/Manila, UTC+8, no DST); weeks start on Monday. Only `production` counts.
 */
import { createHash } from 'node:crypto';
import { sql } from 'drizzle-orm';
import { rows, type DB } from './db/types';

export const TZ = 'Asia/Manila';
const TZ_MS = 8 * 3600_000;
const RAW_RETENTION_DAYS = 90;
const MAX_DURATION_MS = 60 * 60_000;
export const RANGE_DAYS = { '24h': 1, '7d': 7, '30d': 30, '90d': 90, '1y': 365 } as const;
export type RangeId = keyof typeof RANGE_DAYS;

/** Every event the site sends (src/lib/analytics.ts) plus the tracker's own page_view / page_time. */
export const EVENTS = new Set([
  'page_view',
  'page_time',
  'dock_nav',
  'sys_toggle',
  'log_open',
  'moment_open',
  'chapter_card',
  'embed_play',
  'bgm_play',
  'clip_open',
  'clip_filter',
  'song_play',
  'disco_tab',
  'disco_view',
  'stream_open',
  'stream_filter',
  'stream_search',
  'event_open',
  'art_open',
  'art_section',
  'talk_start',
  'talk_choice',
  'talk_end',
  'talk_goto',
  'talk_hide',
  'album_open',
  'note_post',
  'note_undo',
  'note_report',
  'board_sort',
  'board_more',
  'outbound',
  'help_open',
  'tour',
  'tour_replay',
  'outfit_pick',
  'time_open',
  'time_travel',
  'cwv',
  'not_found',
]);

// ---------------------------------------------------------------- days in the keeper's time zone
export const localDay = (d = new Date()) => new Date(d.getTime() + TZ_MS).toISOString().slice(0, 10);
export const addDays = (day: string, n: number) =>
  new Date(Date.parse(`${day}T00:00:00Z`) + n * 86400_000).toISOString().slice(0, 10);
/** Start of a local calendar day as a UTC instant (ISO). */
const dayStart = (day: string) => new Date(Date.parse(`${day}T00:00:00+08:00`)).toISOString();
const mondayOf = (day: string) => addDays(day, -((new Date(`${day}T00:00:00Z`).getUTCDay() + 6) % 7));

// ---------------------------------------------------------------- who is this (without knowing who)
export const BOT_UA =
  /bot|crawl|spider|slurp|headless|lighthouse|pagespeed|preview|facebookexternalhit|embedly|curl|wget|python|node-fetch|axios|go-http|playwright/i;

/** Changes every day, so a visitor can be counted once per day but never followed across days. */
export function visitorHash(salt: string, ip: string, ua: string, day = localDay()) {
  return createHash('sha256').update(`${salt}|${day}|${ip}|${ua}`).digest('hex').slice(0, 32);
}
export function browserOf(ua: string) {
  if (/\bLine\//i.test(ua)) return 'LINE app';
  if (/Instagram/i.test(ua)) return 'Instagram app';
  if (/FBAN|FBAV/.test(ua)) return 'Facebook app';
  if (/Edg(e|A|iOS)?\//.test(ua)) return 'Edge';
  if (/OPR\/|Opera/.test(ua)) return 'Opera';
  if (/SamsungBrowser/.test(ua)) return 'Samsung Internet';
  if (/Firefox\/|FxiOS/.test(ua)) return 'Firefox';
  if (/CriOS|Chrome\//.test(ua)) return 'Chrome';
  if (/Safari\//.test(ua)) return 'Safari';
  return 'Other';
}
export function osOf(ua: string) {
  if (/iPhone|iPad|iPod/.test(ua)) return 'iOS';
  if (/Android/.test(ua)) return 'Android';
  if (/Windows/.test(ua)) return 'Windows';
  if (/Mac OS X/.test(ua)) return 'macOS';
  if (/CrOS/.test(ua)) return 'ChromeOS';
  if (/Linux/.test(ua)) return 'Linux';
  return 'Other';
}
const DEVICES = new Set(['mobile', 'tablet', 'desktop']);
export function deviceOf(ua: string, hint?: unknown) {
  if (typeof hint === 'string' && DEVICES.has(hint)) return hint;
  if (/iPad|Tablet|Android(?!.*Mobile)/i.test(ua)) return 'tablet';
  if (/Mobi|iPhone|Android/i.test(ua)) return 'mobile';
  return 'desktop';
}
function cleanHost(v: unknown, ownHost: string) {
  if (typeof v !== 'string' || !v) return null;
  const host = v
    .toLowerCase()
    .replace(/^www\./, '')
    .slice(0, 100);
  if (!/^[a-z0-9.-]+$/.test(host) || host === ownHost.toLowerCase().replace(/^www\./, '')) return null;
  return host;
}
const cleanPath = (v: unknown) =>
  typeof v === 'string' && /^\/[\w\-./~%]{0,120}$/.test(v) ? v.replace(/\/+$/, '') || '/' : null;

// ---------------------------------------------------------------- beacon → rows
export type EventRow = {
  event: string;
  path: string | null;
  visitId: string;
  visitorHash: string;
  device: string;
  browser: string;
  os: string;
  language: string | null;
  country: string | null;
  referrerHost: string | null;
  durationMs: number | null;
  props: Record<string, string | number | boolean> | null;
  environment: string;
};

/**
 * One beacon `{ v: visitId, d: device, l: lang, r: referrer host, p: path, e: [{ t, p?, ms?, x? }] }` → rows.
 * Unknown or malformed events are dropped silently: analytics must never throw at visitors.
 */
export function parseBeacon(
  body: unknown,
  ctx: { ua: string; visitorHash: string; country?: string | null; environment: string; ownHost: string },
): EventRow[] {
  const b = body as Record<string, unknown> | null;
  if (!b || typeof b !== 'object' || !Array.isArray(b.e)) return [];
  const visitId = typeof b.v === 'string' && /^[a-z0-9-]{8,64}$/i.test(b.v) ? b.v : null;
  if (!visitId) return [];
  const base = {
    visitId,
    visitorHash: ctx.visitorHash,
    device: deviceOf(ctx.ua, b.d),
    browser: browserOf(ctx.ua),
    os: osOf(ctx.ua),
    language: b.l === 'ja' || b.l === 'en' ? b.l : null,
    country: /^[A-Z]{2}$/.test(ctx.country ?? '') ? ctx.country! : null,
    environment: ctx.environment,
  };
  const out: EventRow[] = [];
  for (const raw of (b.e as unknown[]).slice(0, 50)) {
    const e = raw as Record<string, unknown> | null;
    if (!e || typeof e !== 'object' || typeof e.t !== 'string' || !EVENTS.has(e.t)) continue;
    let props: Record<string, string | number | boolean> | null = null;
    if (e.x && typeof e.x === 'object') {
      props = {};
      for (const [k, v] of Object.entries(e.x as Record<string, unknown>).slice(0, 5)) {
        if (!/^[a-z_]{1,20}$/.test(k)) continue;
        if (typeof v === 'string') props[k] = v.slice(0, 60);
        else if ((typeof v === 'number' && Number.isFinite(v)) || typeof v === 'boolean') props[k] = v;
      }
      if (!Object.keys(props).length) props = null;
    }
    const ms =
      typeof e.ms === 'number' && Number.isInteger(e.ms) && e.ms >= 0
        ? Math.min(e.ms, MAX_DURATION_MS)
        : null;
    if (e.t === 'page_time' && !ms) continue;
    out.push({
      ...base,
      event: e.t,
      path: cleanPath(e.p ?? b.p),
      referrerHost: e.t === 'page_view' ? cleanHost(b.r, ctx.ownHost) : null,
      durationMs: ms,
      props,
    });
  }
  return out;
}

export async function insertEvents(db: DB, list: EventRow[]) {
  if (!list.length) return;
  await db.execute(sql`INSERT INTO analytics_events
    (event, path, visit_id, visitor_hash, device, browser, os, language, country, referrer_host, duration_ms, props, environment)
    VALUES ${sql.join(
      list.map(
        (r) =>
          sql`(${r.event}, ${r.path}, ${r.visitId}, ${r.visitorHash}, ${r.device}, ${r.browser}, ${r.os}, ${r.language},
            ${r.country}, ${r.referrerHost}, ${r.durationMs}, ${r.props ? JSON.stringify(r.props) : null}::jsonb, ${r.environment})`,
      ),
      sql`, `,
    )}`);
}

// ---------------------------------------------------------------- one query for every number, per local day
const aggregate = (from: string, to: string) => sql`
with ev as (
  select *, (occurred_at at time zone ${TZ})::date as day
  from analytics_events
  where occurred_at >= ${from}::timestamptz and occurred_at < ${to}::timestamptz and environment = 'production'
),
pv as (select * from ev where event = 'page_view'),
per_visit as (select day, visit_id, count(*) as n from pv group by 1, 2),
m (day, metric, dimension, value) as (
            select day, 'visits', '', count(distinct visit_id) from pv group by 1
  union all select day, 'uniques', '', count(distinct visitor_hash) from pv group by 1
  union all select day, 'page_views', '', count(*) from pv group by 1
  union all select day, 'bounces', '', count(*) from per_visit where n = 1 group by 1
  union all select day, 'device', coalesce(device, 'desktop'), count(distinct visit_id) from pv group by 1, 3
  union all select day, 'browser', coalesce(browser, 'Other'), count(distinct visit_id) from pv group by 1, 3
  union all select day, 'os', coalesce(os, 'Other'), count(distinct visit_id) from pv group by 1, 3
  union all select day, 'language', coalesce(language, ''), count(distinct visit_id) from pv group by 1, 3
  union all select day, 'country', coalesce(country, '??'), count(distinct visit_id) from pv group by 1, 3
  union all select day, 'source', coalesce(referrer_host, ''), count(*) from pv where referrer_host is not null group by 1, 3
  union all select day, 'path', coalesce(path, '/'), count(*) from pv group by 1, 3
  union all select day, 'dow_hour',
              extract(dow from occurred_at at time zone ${TZ})::int || ':' || extract(hour from occurred_at at time zone ${TZ})::int,
              count(*) from pv group by 1, 3
  union all select day, 'visit_ms', '', sum(duration_ms)::bigint from ev where event = 'page_time' group by 1
  union all select day, 'visits_timed', '', count(distinct visit_id) from ev where event = 'page_time' group by 1
  union all select day, 'event', event, count(*) from ev where event not in ('page_view', 'page_time') group by 1, 3
  union all select day, 'prop', event || '.' || kv.key || '=' || kv.value, count(*)
              from ev cross join lateral jsonb_each_text(coalesce(props, '{}'::jsonb)) kv
              where event not in ('page_view', 'page_time') group by 1, 3
)`;

type DayRow = { day: string; metric: string; dimension: string; value: number };

async function aggregateLive(db: DB, fromDay: string, toDayExclusive: string): Promise<DayRow[]> {
  const r = rows<DayRow>(
    await db.execute(sql`${aggregate(dayStart(fromDay), dayStart(toDayExclusive))}
      select to_char(day, 'YYYY-MM-DD') as day, metric, dimension, value::bigint as value from m where value > 0`),
  );
  return r.map((x) => ({ ...x, value: Number(x.value) }));
}

async function lastRolledDay(db: DB): Promise<string | null> {
  const [r] = rows<{ day: string | null }>(
    await db.execute(
      sql`select to_char(max(day), 'YYYY-MM-DD') as day from analytics_daily where metric = '_rolled'`,
    ),
  );
  return r?.day ?? null;
}

let rolledToday: string | null = null; // per-instance memo
let lastAttempt = 0;

/**
 * Rolls every finished local day (up to yesterday) into analytics_daily and prunes raw events older than 90 days
 * (only once their day is rolled). Idempotent, safe to run concurrently. Called from the tracker, the Keeper and
 * the nightly clean-up, so no extra cron is needed.
 */
export async function rollupIfStale(db: DB, { force = false } = {}) {
  const today = localDay();
  if (!force && (rolledToday === today || Date.now() - lastAttempt < 10 * 60_000)) return { skipped: true };
  lastAttempt = Date.now();
  const yesterday = addDays(today, -1);
  const last = await lastRolledDay(db);
  let from = last ? addDays(last, 1) : null;
  if (!from) {
    const [first] = rows<{ day: string | null }>(
      await db.execute(
        sql`select to_char(min(occurred_at at time zone ${TZ}), 'YYYY-MM-DD') as day from analytics_events where environment = 'production'`,
      ),
    );
    from = first?.day ?? today;
  }
  let rolled = 0;
  if (from <= yesterday) {
    await db.execute(sql`delete from analytics_daily where day >= ${from}::date and day < ${today}::date`);
    await db.execute(sql`${aggregate(dayStart(from), dayStart(today))}
      insert into analytics_daily (day, metric, dimension, value)
      select day, metric, dimension, value from m where value > 0
      on conflict (day, metric, dimension) do update set value = excluded.value`);
    await db.execute(sql`insert into analytics_daily (day, metric, dimension, value)
      select d::date, '_rolled', '', 1 from generate_series(${from}::date, ${yesterday}::date, interval '1 day') as d
      on conflict (day, metric, dimension) do nothing`);
    rolled = Math.round((Date.parse(yesterday) - Date.parse(from)) / 86400_000) + 1;
  }
  await db.execute(sql`delete from analytics_events
    where occurred_at < now() - make_interval(days => ${RAW_RETENTION_DAYS})
      and (occurred_at at time zone ${TZ})::date <= (select max(day) from analytics_daily where metric = '_rolled')`);
  rolledToday = today;
  return { rolled, from, to: yesterday };
}
/** Tests reset the per-instance memo. */
export const _resetRollupMemo = () => {
  rolledToday = null;
  lastAttempt = 0;
};

/** Daily rows for [fromDay, today]: rolled days from analytics_daily, the rest computed live. */
async function dailyRows(db: DB, fromDay: string, today: string, metrics: string[]): Promise<DayRow[]> {
  const last = await lastRolledDay(db);
  const liveFrom = last && last >= fromDay ? addDays(last, 1) : fromDay;
  const rolled =
    last && last >= fromDay
      ? rows<DayRow>(
          await db.execute(sql`select to_char(day, 'YYYY-MM-DD') as day, metric, dimension, value from analytics_daily
            where day >= ${fromDay}::date and day <= ${last}::date
              and metric in ${sql`(${sql.join(
                metrics.map((m) => sql`${m}`),
                sql`, `,
              )})`}`),
        ).map((r) => ({ ...r, value: Number(r.value) }))
      : [];
  const live =
    liveFrom <= today
      ? (await aggregateLive(db, liveFrom, addDays(today, 1))).filter((r) => metrics.includes(r.metric))
      : [];
  return rolled.concat(live);
}

// ---------------------------------------------------------------- what the Keeper shows
type Metric = { x: string; y: number };
const STAT_KEYS = ['visitors', 'visits', 'pageviews', 'bounces', 'totaltime'] as const;
type StatKey = (typeof STAT_KEYS)[number];
export type Stats = Record<StatKey, number> & { prev: Record<StatKey, number | null> };

const sumBy = (list: DayRow[], metric: string) => {
  const out: Record<string, number> = {};
  for (const r of list) if (r.metric === metric) out[r.dimension] = (out[r.dimension] ?? 0) + r.value;
  return out;
};
const total = (list: DayRow[], metric: string) =>
  list.reduce((s, r) => (r.metric === metric ? s + r.value : s), 0);
const topList = (o: Record<string, number>, n: number): Metric[] =>
  Object.entries(o)
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([x, y]) => ({ x, y }));

function statsOf(list: DayRow[]): Record<StatKey, number> {
  const visits = total(list, 'visits');
  const timed = total(list, 'visits_timed');
  const ms = total(list, 'visit_ms');
  return {
    visitors: total(list, 'uniques'),
    visits,
    pageviews: total(list, 'page_views'),
    bounces: total(list, 'bounces'),
    // total time on site, scaled up from the visits that reported a time (in seconds)
    totaltime: timed ? Math.round((ms / 1000 / timed) * visits) : 0,
  };
}

const BREAKDOWN = [
  'visits',
  'uniques',
  'page_views',
  'bounces',
  'visit_ms',
  'visits_timed',
  'device',
  'browser',
  'os',
  'language',
  'country',
  'source',
  'path',
  'dow_hour',
];

/** Dashboard + Visitors page data, in the shapes src/scripts/keeper/visitors.ts reads. */
export async function visitors(db: DB, rangeId: string, unit: 'day' | 'week' | 'month', full: boolean) {
  await rollupIfStale(db).catch(() => {});
  const today = localDay();
  const days = RANGE_DAYS[rangeId as RangeId] ?? 7;
  const from = addDays(today, -(days - 1));
  const prevFrom = addDays(from, -days);
  const [series, rangeRows] = await Promise.all([
    dailyRows(db, addDays(today, -364), today, ['visits', 'uniques', 'page_views']),
    dailyRows(db, prevFrom, today, BREAKDOWN),
  ]);
  const cur = rangeRows.filter((r) => r.day >= from);
  const prev = rangeRows.filter((r) => r.day < from);
  const s = statsOf(cur);
  const p = statsOf(prev);
  const hasPrev = prev.length > 0;

  const byDay: Record<string, { pv: number; uv: number; visits: number }> = {};
  for (const r of series) {
    byDay[r.day] ??= { pv: 0, uv: 0, visits: 0 };
    if (r.metric === 'page_views') byDay[r.day]!.pv += r.value;
    if (r.metric === 'uniques') byDay[r.day]!.uv += r.value;
    if (r.metric === 'visits') byDay[r.day]!.visits += r.value;
  }
  const period = (start: string) => {
    let pv = 0;
    let uv = 0;
    let visits = 0;
    for (const [d, v] of Object.entries(byDay)) {
      if (d < start) continue;
      pv += v.pv;
      uv += v.uv;
      visits += v.visits;
    }
    return {
      visitors: uv,
      visits,
      pageviews: pv,
      bounces: 0,
      totaltime: 0,
      prev: { visitors: null, visits: null, pageviews: null, bounces: null, totaltime: null },
    };
  };
  const buckets: { x: string; from: string; to: string }[] = [];
  if (unit === 'month') {
    const [y, m] = today.split('-').map(Number) as [number, number];
    for (let i = 11; i >= 0; i--) {
      const start = new Date(Date.UTC(y, m - 1 - i, 1)).toISOString().slice(0, 10);
      const next = new Date(Date.UTC(y, m - i, 1)).toISOString().slice(0, 10);
      buckets.push({ x: start.slice(0, 7), from: start, to: next });
    }
  } else if (unit === 'week') {
    const mon = mondayOf(today);
    for (let i = 11; i >= 0; i--) {
      const start = addDays(mon, -7 * i);
      buckets.push({ x: start, from: start, to: addDays(start, 7) });
    }
  } else {
    const n = Math.max(7, Math.min(days, 90));
    for (let i = n - 1; i >= 0; i--) {
      const d = addDays(today, -i);
      buckets.push({ x: d, from: d, to: addDays(d, 1) });
    }
  }
  const sumIn = (b: { from: string; to: string }, k: 'pv' | 'uv') =>
    Object.entries(byDay).reduce((a, [d, v]) => (d >= b.from && d < b.to ? a + v[k] : a), 0);

  const limit = full ? 25 : 8;
  let weekly: number[][] | null = null;
  if (full) {
    weekly = Array.from({ length: 7 }, () => Array<number>(24).fill(0));
    for (const [k, v] of Object.entries(sumBy(cur, 'dow_hour'))) {
      const [dow, hr] = k.split(':').map(Number) as [number, number];
      if (weekly[dow] && hr >= 0 && hr < 24) weekly[dow]![hr]! += v;
    }
  }
  return {
    stats: { ...s, prev: Object.fromEntries(STAT_KEYS.map((k) => [k, hasPrev ? p[k] : null])) } as Stats,
    periods: {
      today: period(today),
      week: period(mondayOf(today)),
      month: period(`${today.slice(0, 7)}-01`),
    },
    unit,
    series: {
      pageviews: buckets.map((b) => ({ x: b.x, y: sumIn(b, 'pv') })),
      sessions: buckets.map((b) => ({ x: b.x, y: sumIn(b, 'uv') })),
    },
    paths: topList(sumBy(cur, 'path'), limit),
    referrers: topList(sumBy(cur, 'source'), limit),
    countries: topList(sumBy(cur, 'country'), limit),
    devices: topList(sumBy(cur, 'device'), limit),
    browsers: topList(sumBy(cur, 'browser'), limit),
    os: full ? topList(sumBy(cur, 'os'), limit) : [],
    languages: full ? topList(sumBy(cur, 'language'), limit) : [],
    weekly,
    fetchedAt: Date.now(),
  };
}

/** How many times each event fired in the range. */
export async function eventCounts(db: DB, rangeId: string): Promise<Metric[]> {
  const today = localDay();
  const days = RANGE_DAYS[rangeId as RangeId] ?? 30;
  return topList(sumBy(await dailyRows(db, addDays(today, -(days - 1)), today, ['event']), 'event'), 200);
}

/** Values of one property of one event, e.g. ('stream_open', 'id') → [{ value: 'abc', total: 12 }]. */
export async function eventValues(db: DB, rangeId: string, event: string, prop: string) {
  const today = localDay();
  const days = RANGE_DAYS[rangeId as RangeId] ?? 30;
  const prefix = `${event}.${prop}=`;
  const all = sumBy(await dailyRows(db, addDays(today, -(days - 1)), today, ['prop']), 'prop');
  return Object.entries(all)
    .filter(([k]) => k.startsWith(prefix))
    .map(([k, v]) => ({ value: k.slice(prefix.length), total: v }))
    .sort((a, b) => b.total - a.total);
}

/** Visits with any event in the last 5 minutes. */
export async function activeNow(db: DB): Promise<number> {
  const [r] = rows<{ n: number }>(
    await db.execute(sql`select count(distinct visit_id)::int as n from analytics_events
      where occurred_at > now() - interval '5 minutes' and environment = 'production'`),
  );
  return Number(r?.n ?? 0);
}

/** Daily digest (cron): unique visitors yesterday-to-now (last 24 h of whole days ≈ today + yesterday's tail). */
export async function visitors24h(db: DB): Promise<number> {
  const [r] = rows<{ n: number }>(
    await db.execute(sql`select count(distinct visitor_hash)::int as n from analytics_events
      where occurred_at > now() - interval '24 hours' and environment = 'production' and event = 'page_view'`),
  );
  return Number(r?.n ?? 0);
}
