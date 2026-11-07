/**
 * First-party, cookieless analytics (docs/ANALYTICS-REBUILD-PLAN.md), after moekoworks_official and the Kotoha fan
 * site: beacon checks, a visitor hash with a random salt per day (kept in the database), and the Keeper's numbers.
 *
 * One source of truth: every number is computed by the same `aggregate` query. Days still in the raw table (the
 * last 90, and any not rolled up yet) are always computed from raw events; only older days come from
 * analytics_daily, which the nightly cron fills with that very query. So the dashboard, the Visitors page, the
 * insights and the Discord digest can't disagree.
 *
 * Definitions (local days in Asia/Manila, UTC+8, no DST; weeks start on Monday):
 * - page view: one `page_view` event
 * - visit: a distinct visit id (one browser tab) with a page view that day
 * - visitor: a distinct visitor hash that day; over several days, the daily counts are added up (the hash changes
 *   every day on purpose, so the same person on two days can't be recognised)
 * - bounce: a visit with exactly one page view that day
 * - average visit: visible time on the site (`page_dwell`) ÷ visits that reported any
 * - on the site now: distinct visits that sent any event in the last 5 minutes
 */
import { createHmac, randomBytes } from 'node:crypto';
import { sql } from 'drizzle-orm';
import { rows, type DB } from './db/types';

export const TZ = 'Asia/Manila';
const TZ_MS = 8 * 3600_000;
export const RAW_RETENTION_DAYS = 90;
const MAX_DURATION_MS = 60 * 60_000;
export const RANGE_DAYS = { today: 1, '7d': 7, '30d': 30, '90d': 90, '1y': 365 } as const;
export type RangeId = keyof typeof RANGE_DAYS;
export const rangeOf = (v: string | null | undefined, fallback: RangeId): RangeId =>
  v && v in RANGE_DAYS ? (v as RangeId) : fallback;

/** Every event the site sends (src/lib/analytics.ts) plus the tracker's own page_view / page_dwell. */
export const EVENTS = new Set([
  'page_view',
  'page_dwell',
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
export const mondayOf = (day: string) => addDays(day, -((new Date(`${day}T00:00:00Z`).getUTCDay() + 6) % 7));

// ---------------------------------------------------------------- who is this (without knowing who)
export const BOT_UA =
  /bot|crawl|spider|slurp|headless|lighthouse|pagespeed|preview|facebookexternalhit|embedly|curl|wget|python|node-fetch|axios|go-http|playwright/i;

const salts = new Map<string, string>(); // per-instance cache: day → salt
/** Today's random salt, made by whichever request needs it first (one statement, safe when concurrent). */
export async function saltFor(db: DB, day = localDay()): Promise<string> {
  const cached = salts.get(day);
  if (cached) return cached;
  const [r] = rows<{ salt: string }>(
    await db.execute(sql`insert into analytics_salts (day, salt) values (${day}::date, ${randomBytes(32).toString('hex')})
      on conflict (day) do update set day = excluded.day returning salt`),
  );
  if (!r?.salt) throw new Error('no analytics salt');
  salts.clear();
  salts.set(day, r.salt);
  return r.salt;
}
/** Tests reset the per-instance cache. */
export const _resetSaltCache = () => salts.clear();

/** Changes every day with the salt, so a visitor can be counted once per day but never followed across days. */
export function visitorHash(salt: string, ip: string, ua: string) {
  return createHmac('sha256', salt).update(`${ip}|${ua}`).digest('hex').slice(0, 32);
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
    if (e.t === 'page_dwell' && !ms) continue;
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
/** `allEnv` adds preview and development traffic (raw days only: daily totals are production). */
const aggregate = (from: string, to: string, allEnv = false) => sql`
with ev as (
  select *, (occurred_at at time zone ${TZ})::date as day
  from analytics_events
  where occurred_at >= ${from}::timestamptz and occurred_at < ${to}::timestamptz
    and ${allEnv ? sql`true` : sql`environment = 'production'`}
),
pv as (select * from ev where event = 'page_view'),
per_visit as (select day, visit_id, count(*) as n from pv group by 1, 2),
dwell as (select day, visit_id, sum(duration_ms)::bigint as ms from ev where event = 'page_dwell' group by 1, 2),
m (day, metric, dimension, value) as (
            select day, 'visits', '', count(distinct visit_id) from pv group by 1
  union all select day, 'visitors', '', count(distinct visitor_hash) from pv group by 1
  union all select day, 'page_views', '', count(*) from pv group by 1
  union all select day, 'bounces', '', count(*) from per_visit where n = 1 group by 1
  union all select day, 'dwell_ms', '', sum(ms)::bigint from dwell group by 1
  union all select day, 'visits_timed', '', count(*) from dwell group by 1
  union all select day, 'device', device, count(distinct visit_id) from pv group by 1, 3
  union all select day, 'browser', coalesce(browser, 'Other'), count(distinct visit_id) from pv group by 1, 3
  union all select day, 'os', coalesce(os, 'Other'), count(distinct visit_id) from pv group by 1, 3
  union all select day, 'language', coalesce(language, ''), count(distinct visit_id) from pv group by 1, 3
  union all select day, 'country', coalesce(country, '??'), count(distinct visit_id) from pv group by 1, 3
  union all select day, 'source', referrer_host, count(*) from pv where referrer_host is not null group by 1, 3
  union all select day, 'path', coalesce(path, '/'), count(*) from pv group by 1, 3
  union all select day, 'dow_hour',
              extract(dow from occurred_at at time zone ${TZ})::int || ':' || extract(hour from occurred_at at time zone ${TZ})::int,
              count(*) from pv group by 1, 3
  union all select day, 'event', event, count(*) from ev where event not in ('page_view', 'page_dwell') group by 1, 3
  union all select day, 'prop', event || '.' || kv.key || '=' || kv.value, count(*)
              from ev cross join lateral jsonb_each_text(coalesce(props, '{}'::jsonb)) kv
              where event not in ('page_view', 'page_dwell') group by 1, 3
)`;

export type DayRow = { day: string; metric: string; dimension: string; value: number };

async function aggregateRaw(db: DB, fromDay: string, toDayExclusive: string, allEnv: boolean) {
  if (fromDay >= toDayExclusive) return [];
  const r = rows<DayRow>(
    await db.execute(sql`${aggregate(dayStart(fromDay), dayStart(toDayExclusive), allEnv)}
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

/**
 * Daily rows for [fromDay, today]. Days after the last rolled day, and every day of the last 90, come from raw
 * events; only older, rolled days come from analytics_daily. `metrics` filters (empty = all).
 */
export async function dailyRows(
  db: DB,
  fromDay: string,
  { today = localDay(), metrics = [] as string[], allEnv = false } = {},
): Promise<DayRow[]> {
  const rawFrom = addDays(today, -(RAW_RETENTION_DAYS - 1));
  const last = await lastRolledDay(db);
  // first day read from raw: never later than the raw window, never past an unrolled day
  let boundary = last ? addDays(last, 1) : fromDay;
  if (boundary > rawFrom) boundary = rawFrom;
  if (boundary < fromDay) boundary = fromDay;
  const want = (m: string) => !metrics.length || metrics.includes(m);
  const old =
    fromDay < boundary
      ? rows<DayRow>(
          await db.execute(sql`select to_char(day, 'YYYY-MM-DD') as day, metric, dimension, value from analytics_daily
            where day >= ${fromDay}::date and day < ${boundary}::date and metric <> '_rolled'`),
        ).map((r) => ({ ...r, value: Number(r.value) }))
      : [];
  const recent = await aggregateRaw(db, boundary, addDays(today, 1), allEnv);
  return old.concat(recent).filter((r) => want(r.metric));
}

/**
 * Nightly (cron): rolls every finished production day not rolled yet into analytics_daily with the same query the
 * Keeper uses, in ONE statement (all or nothing), then prunes raw events older than 90 days that are rolled and
 * salts older than yesterday. Idempotent: a finished day's raw events never change, so re-rolling gives the same
 * rows.
 */
export async function rollup(db: DB, today = localDay()) {
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
    await db.execute(sql`${aggregate(dayStart(from), dayStart(today))}
      insert into analytics_daily (day, metric, dimension, value)
      select day, metric, dimension, value from m where value > 0
      union all
      select d::date, '_rolled', '', 1 from generate_series(${from}::date, ${yesterday}::date, interval '1 day') as d
      on conflict (day, metric, dimension) do update set value = excluded.value`);
    rolled = Math.round((Date.parse(yesterday) - Date.parse(from)) / 86400_000) + 1;
  }
  await db.execute(sql`delete from analytics_events
    where occurred_at < now() - make_interval(days => ${RAW_RETENTION_DAYS})
      and (occurred_at at time zone ${TZ})::date <= (select max(day) from analytics_daily where metric = '_rolled')`);
  await db.execute(sql`delete from analytics_salts where day < ${yesterday}::date`);
  return { rolled, from, to: yesterday };
}

// ---------------------------------------------------------------- what the Keeper shows
type Metric = { x: string; y: number };
export type Totals = {
  visits: number;
  visitors: number;
  pageviews: number;
  bounces: number;
  /** average visible time per timed visit, in seconds (null: no visit reported any) */
  avgVisit: number | null;
};
export type Stats = Totals & { prev: Totals | null };

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
const between = (list: DayRow[], from: string, toExclusive: string) =>
  list.filter((r) => r.day >= from && r.day < toExclusive);

export function totalsOf(list: DayRow[]): Totals {
  const timed = total(list, 'visits_timed');
  return {
    visits: total(list, 'visits'),
    visitors: total(list, 'visitors'),
    pageviews: total(list, 'page_views'),
    bounces: total(list, 'bounces'),
    avgVisit: timed ? Math.round(total(list, 'dwell_ms') / 1000 / timed) : null,
  };
}

/** Dashboard + Visitors page data, in the shapes src/scripts/keeper/visitors.ts reads. */
export async function visitors(
  db: DB,
  rangeId: RangeId,
  unit: 'day' | 'week' | 'month',
  { full = false, allEnv = false, today = localDay() } = {},
) {
  const days = RANGE_DAYS[rangeId];
  const from = addDays(today, -(days - 1));
  const prevFrom = addDays(from, -days);
  const tomorrow = addDays(today, 1);
  // one read covers the chart (a year back), the periods, this range and the one before it
  const yearAgo = addDays(today, -364);
  const all = await dailyRows(db, prevFrom < yearAgo ? prevFrom : yearAgo, { today, allEnv });
  const cur = between(all, from, tomorrow);
  const prev = between(all, prevFrom, from);
  const hasData = (l: DayRow[]) => l.some((r) => r.metric === 'page_views');

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
    const n = Math.max(14, Math.min(days, 90));
    for (let i = n - 1; i >= 0; i--) {
      const d = addDays(today, -i);
      buckets.push({ x: d, from: d, to: addDays(d, 1) });
    }
  }
  const series = buckets.map((b) => ({ x: b.x, ...totalsOf(between(all, b.from, b.to)) }));

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
    range: rangeId,
    from,
    today,
    allEnv,
    stats: { ...totalsOf(cur), prev: hasData(prev) ? totalsOf(prev) : null } as Stats,
    periods: {
      today: totalsOf(between(all, today, tomorrow)),
      week: totalsOf(between(all, mondayOf(today), tomorrow)),
      month: totalsOf(between(all, `${today.slice(0, 7)}-01`, tomorrow)),
    },
    unit,
    series: {
      pageviews: series.map((s) => ({ x: s.x, y: s.pageviews })),
      visits: series.map((s) => ({ x: s.x, y: s.visits })),
      visitors: series.map((s) => ({ x: s.x, y: s.visitors })),
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
export async function eventCounts(db: DB, rangeId: RangeId, today = localDay()): Promise<Metric[]> {
  const from = addDays(today, -(RANGE_DAYS[rangeId] - 1));
  return topList(sumBy(await dailyRows(db, from, { today, metrics: ['event'] }), 'event'), 200);
}

/** Every event property in the range: 'stream_open.id=abc' → count. Read once, then sliced per card. */
export async function eventProps(db: DB, rangeId: RangeId, today = localDay()) {
  const from = addDays(today, -(RANGE_DAYS[rangeId] - 1));
  return sumBy(await dailyRows(db, from, { today, metrics: ['prop'] }), 'prop');
}
/** Values of one property of one event from eventProps(), e.g. ('stream_open', 'id') → [{ value, total }]. */
export function valuesOf(all: Record<string, number>, event: string, prop: string) {
  const prefix = `${event}.${prop}=`;
  return Object.entries(all)
    .filter(([k]) => k.startsWith(prefix))
    .map(([k, v]) => ({ value: k.slice(prefix.length), total: v }))
    .sort((a, b) => b.total - a.total);
}

/** Visits that sent any event in the last 5 minutes. */
export async function activeNow(db: DB): Promise<number> {
  const [r] = rows<{ n: number }>(
    await db.execute(sql`select count(distinct visit_id)::int as n from analytics_events
      where occurred_at > now() - interval '5 minutes' and environment = 'production'`),
  );
  return Number(r?.n ?? 0);
}

/** One finished local day's totals (the Discord digest reports yesterday), same numbers as the Keeper's. */
export async function dayTotals(db: DB, day: string): Promise<Totals> {
  return totalsOf(between(await dailyRows(db, day, { today: addDays(day, 1) }), day, addDays(day, 1)));
}
