/** First-party analytics (docs/ANALYTICS-REBUILD-PLAN.md): beacon parsing, salts, numbers, roll-up, endpoint. */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { sql } from 'drizzle-orm';
import { freshDb } from './helpers';
import {
  activeNow,
  addDays,
  dayTotals,
  eventCounts,
  eventProps,
  insertEvents,
  localDay,
  parseBeacon,
  rollup,
  saltFor,
  valuesOf,
  visitorHash,
  visitors,
  _resetSaltCache,
} from '../../src/server/analytics';
import { rows, type DB } from '../../src/server/db/types';

let db: DB;
vi.mock('../../src/server/db/http', () => ({ db: () => db }));
const { POST, environmentOf } = await import('../../src/pages/api/hi');

const UA_PHONE =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile/15E148 Safari/604.1';
const UA_PC = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/130.0 Safari/537.36';
const HOST = 'aqua-iro-archive.vercel.app';
const ctx = (ua: string, ip: string, environment = 'production') => ({
  ua,
  visitorHash: visitorHash('test-salt', ip, ua),
  country: 'JP',
  environment,
  ownHost: HOST,
});

beforeEach(async () => {
  ({ db } = await freshDb());
  _resetSaltCache();
});

/** One visit: page views on `paths` (30 s visible on the first), plus extra events, `daysAgo` days back. */
async function visit(
  id: string,
  ua: string,
  ip: string,
  paths: string[],
  extra: object[] = [],
  daysAgo = 0,
  environment = 'production',
) {
  const list = parseBeacon(
    {
      v: `visit-${id}-test`,
      l: 'ja',
      r: 'x.com',
      e: [
        ...paths.map((p) => ({ t: 'page_view', p })),
        { t: 'page_dwell', p: paths[0], ms: 30_000 },
        ...extra,
      ],
    },
    ctx(ua, ip, environment),
  );
  await insertEvents(db, list);
  if (daysAgo)
    await db.execute(
      sql`update analytics_events set occurred_at = now() - make_interval(days => ${daysAgo}) where visit_id = ${`visit-${id}-test`}`,
    );
}

describe('beacons and the visitor hash', () => {
  it('drops malformed beacons and unknown events, and caps properties', () => {
    expect(parseBeacon(null, ctx(UA_PC, '1.1.1.1'))).toEqual([]);
    expect(parseBeacon({ v: 'x', e: [] }, ctx(UA_PC, '1.1.1.1'))).toEqual([]); // visit id too short
    const list = parseBeacon(
      {
        v: 'visit-abcdef12',
        e: [
          { t: 'page_view', p: '/streaming' },
          { t: 'made_up_event' },
          { t: 'page_dwell', ms: 0 }, // no duration: dropped
          { t: 'stream_open', x: { id: 'a'.repeat(80), year: 2020, Bad: 'no', evil: { nested: 1 } } },
        ],
      },
      ctx(UA_PHONE, '1.1.1.1'),
    );
    expect(list.map((r) => r.event)).toEqual(['page_view', 'stream_open']);
    expect(list[0]).toMatchObject({
      device: 'mobile',
      browser: 'Safari',
      os: 'iOS',
      country: 'JP',
      path: '/streaming',
    });
    expect(list[1]!.props).toEqual({ id: 'a'.repeat(60), year: 2020 });
  });

  it('one random salt per day, kept in the database; the hash never contains the IP', async () => {
    const a = await saltFor(db, '2026-11-03');
    _resetSaltCache();
    expect(await saltFor(db, '2026-11-03')).toBe(a); // another instance gets the same salt
    const b = await saltFor(db, '2026-11-04');
    expect(b).not.toBe(a);
    expect(a).toMatch(/^[0-9a-f]{64}$/);
    const h = visitorHash(a, '203.0.113.9', UA_PC);
    expect(h).toHaveLength(32);
    expect(h).not.toContain('203');
    expect(visitorHash(b, '203.0.113.9', UA_PC)).not.toBe(h);
  });
});

describe('the numbers', () => {
  it('counts today: visits, visitors, page views, bounces, breakdowns and event properties', async () => {
    await visit(
      'a',
      UA_PHONE,
      '1.1.1.1',
      ['/', '/streaming'],
      [{ t: 'stream_open', x: { id: 'abc', year: 2020 } }],
    );
    await visit(
      'b',
      UA_PC,
      '2.2.2.2',
      ['/'],
      [
        { t: 'stream_open', x: { id: 'abc' } },
        { t: 'embed_play', x: { id: 'yt1' } },
      ],
    );
    const v = await visitors(db, 'today', 'day', { full: true });
    expect(v.periods.today).toMatchObject({ visits: 2, visitors: 2, pageviews: 3 });
    expect(v.stats).toMatchObject({ visits: 2, visitors: 2, pageviews: 3, bounces: 1, avgVisit: 30 });
    expect(v.stats.prev).toBeNull(); // nothing yesterday
    expect(v.devices).toEqual(
      expect.arrayContaining([
        { x: 'mobile', y: 1 },
        { x: 'desktop', y: 1 },
      ]),
    );
    expect(v.paths[0]).toEqual({ x: '/', y: 2 });
    expect(v.referrers[0]).toEqual({ x: 'x.com', y: 3 });
    expect(v.languages[0]).toEqual({ x: 'ja', y: 2 });
    expect(v.weekly!.flat().reduce((a, b) => a + b, 0)).toBe(3);
    expect(await eventCounts(db, '7d')).toEqual(
      expect.arrayContaining([
        { x: 'stream_open', y: 2 },
        { x: 'embed_play', y: 1 },
      ]),
    );
    expect(valuesOf(await eventProps(db, '7d'), 'stream_open', 'id')).toEqual([{ value: 'abc', total: 2 }]);
    expect(await activeNow(db)).toBe(2);
  });

  it('every view of the same events agrees: periods, ranges, chart, digest — before and after the roll-up', async () => {
    const today = localDay();
    await visit('d0', UA_PHONE, '1.1.1.1', ['/']);
    await visit('d1a', UA_PC, '2.2.2.2', ['/', '/arts'], [{ t: 'art_open', x: { id: 'kv-5th-fes' } }], 1);
    await visit('d1b', UA_PHONE, '3.3.3.3', ['/clips'], [], 1);
    await visit('d5', UA_PC, '4.4.4.4', ['/', '/clips', '/arts'], [], 5);
    const snapshot = async () => {
      const r7 = await visitors(db, '7d', 'day');
      const chart = (k: 'pageviews' | 'visits' | 'visitors') =>
        r7.series[k].filter((p) => p.x > addDays(today, -7)).reduce((a, p) => a + p.y, 0);
      return {
        stats: r7.stats,
        chart: { pageviews: chart('pageviews'), visits: chart('visits'), visitors: chart('visitors') },
        today: r7.periods.today,
        yesterday: await dayTotals(db, addDays(today, -1)),
        year: (await visitors(db, '1y', 'month')).stats,
        art: valuesOf(await eventProps(db, '7d'), 'art_open', 'id'),
      };
    };
    const before = await snapshot();
    expect(before.stats).toMatchObject({ visits: 4, visitors: 4, pageviews: 7, bounces: 2 });
    expect(before.chart).toEqual({ pageviews: 7, visits: 4, visitors: 4 });
    expect(before.today).toMatchObject({ visits: 1, pageviews: 1 });
    expect(before.yesterday).toMatchObject({ visits: 2, visitors: 2, pageviews: 3 });
    expect(before.year).toMatchObject({ visits: 4, pageviews: 7 });
    expect(before.art).toEqual([{ value: 'kv-5th-fes', total: 1 }]);

    const r = await rollup(db);
    expect(r).toMatchObject({ to: addDays(today, -1) });
    expect(await snapshot()).toEqual(before);
    await rollup(db); // again: nothing changes
    expect(await snapshot()).toEqual(before);
  });

  it('days older than the raw window come from the daily totals, after the raw rows are pruned', async () => {
    await visit('old', UA_PC, '1.1.1.1', ['/', '/arts'], [], 120);
    await visit('new', UA_PHONE, '2.2.2.2', ['/'], [], 2);
    const before = (await visitors(db, '1y', 'month')).stats;
    expect(before).toMatchObject({ visits: 2, pageviews: 3 });
    await rollup(db);
    const left = rows<{ n: number }>(
      await db.execute(
        sql`select count(*)::int as n from analytics_events where visit_id = 'visit-old-test'`,
      ),
    );
    expect(left[0]!.n).toBe(0); // pruned, but still counted:
    expect((await visitors(db, '1y', 'month')).stats).toEqual(before);
    expect((await visitors(db, '90d', 'day')).stats).toMatchObject({ visits: 1, pageviews: 1 });
  });

  it('preview and development visits are hidden unless asked for', async () => {
    await visit('prod', UA_PC, '1.1.1.1', ['/']);
    await visit('prev', UA_PC, '2.2.2.2', ['/'], [], 0, 'preview');
    await visit('dev', UA_PC, '3.3.3.3', ['/'], [], 0, 'development');
    expect((await visitors(db, '7d', 'day')).stats.visits).toBe(1);
    expect((await visitors(db, '7d', 'day', { allEnv: true })).stats.visits).toBe(3);
    await rollup(db);
    const rolledEnv = rows<{ n: number }>(
      await db.execute(sql`select count(*)::int as n from analytics_daily where metric = 'visits'`),
    );
    expect(rolledEnv[0]!.n).toBe(0); // today isn't rolled; nothing from other environments ever is
  });
});

describe('POST /api/hi', () => {
  const beacon = (body: unknown, headers: Record<string, string> = {}) =>
    POST({
      request: new Request(`https://${HOST}/api/hi`, {
        method: 'POST',
        body: typeof body === 'string' ? body : JSON.stringify(body),
        headers: {
          'user-agent': UA_PC,
          host: HOST,
          origin: `https://${HOST}`,
          'x-forwarded-for': '198.51.100.4',
          ...headers,
        },
      }),
      clientAddress: '127.0.0.1',
    } as never) as Promise<Response>;
  const good = { v: 'visit-endpoint1', d: 'desktop', l: 'en', e: [{ t: 'page_view', p: '/' }] };
  const stored = async () =>
    rows<{ n: number }>(await db.execute(sql`select count(*)::int as n from analytics_events`))[0]!.n;

  it('stores a good beacon and says so', async () => {
    const r = await beacon(good);
    expect(r.status).toBe(204);
    expect(r.headers.get('X-Track')).toMatch(/^ok:1; env=/);
    expect(await stored()).toBe(1);
  });

  it.each([
    ['bot', { 'user-agent': 'Googlebot/2.1' }, good],
    ['keeper', { cookie: '__Secure-aia-keeper.session_token=abc' }, good],
    ['origin', { origin: 'https://evil.example' }, good],
    ['origin', { origin: 'null' }, good],
    ['body', {}, '{not json'],
    ['optout', {}, { ...good, nt: 1 }],
    ['empty', {}, { ...good, e: [{ t: 'made_up' }] }],
  ])('drops %s, always with 204', async (why, headers, body) => {
    const r = await beacon(body, headers as Record<string, string>);
    expect(r.status).toBe(204);
    expect(r.headers.get('X-Track')).toMatch(new RegExp(`^dropped:${why}`));
    expect(await stored()).toBe(0);
  });

  it('accepts a beacon without an Origin header (older browsers)', async () => {
    const r = await beacon(good, { origin: '' });
    expect(r.headers.get('X-Track')).toMatch(/^ok:1/);
  });

  it("counts visits to the site's own domain as production even without VERCEL_ENV", () => {
    expect(environmentOf(HOST, undefined)).toBe('production');
    expect(environmentOf('localhost:4321', undefined)).toBe('development');
    expect(environmentOf('aqua-iro-archive-abc123.vercel.app', 'preview')).toBe('preview');
  });
});
