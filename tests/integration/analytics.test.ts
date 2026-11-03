import { beforeEach, describe, expect, it } from 'vitest';
import { sql } from 'drizzle-orm';
import { freshDb } from './helpers';
import {
  activeNow,
  addDays,
  eventCounts,
  eventValues,
  insertEvents,
  localDay,
  parseBeacon,
  rollupIfStale,
  visitorHash,
  visitors,
  _resetRollupMemo,
} from '../../src/server/analytics';
import { rows, type DB } from '../../src/server/db/types';

const UA_PHONE =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile/15E148 Safari/604.1';
const UA_PC = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/130.0 Safari/537.36';
const ctx = (ua: string, ip: string) => ({
  ua,
  visitorHash: visitorHash('test-salt', ip, ua),
  country: 'JP',
  environment: 'production',
  ownHost: 'aqua-iro-archive.vercel.app',
});

let db: DB;
beforeEach(async () => {
  ({ db } = await freshDb());
  _resetRollupMemo();
});

/** One visit: page views on `paths`, plus extra events, `daysAgo` days back. */
async function visit(id: string, ua: string, ip: string, paths: string[], extra: object[] = [], daysAgo = 0) {
  const list = parseBeacon(
    {
      v: `visit-${id}-test`,
      l: 'ja',
      r: 'x.com',
      e: [
        ...paths.map((p) => ({ t: 'page_view', p })),
        { t: 'page_time', p: paths[0], ms: 30_000 },
        ...extra,
      ],
    },
    ctx(ua, ip),
  );
  await insertEvents(db, list);
  if (daysAgo)
    await db.execute(
      sql`update analytics_events set occurred_at = now() - make_interval(days => ${daysAgo}) where visit_id = ${`visit-${id}-test`}`,
    );
}

describe('first-party analytics (docs/ANALYTICS-PLAN.md)', () => {
  it('drops malformed beacons and unknown events, and caps properties', () => {
    expect(parseBeacon(null, ctx(UA_PC, '1.1.1.1'))).toEqual([]);
    expect(parseBeacon({ v: 'x', e: [] }, ctx(UA_PC, '1.1.1.1'))).toEqual([]); // visit id too short
    const list = parseBeacon(
      {
        v: 'visit-abcdef12',
        e: [
          { t: 'page_view', p: '/streaming' },
          { t: 'made_up_event' },
          { t: 'page_time', ms: 0 }, // no duration: dropped
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

  it('the visitor hash changes every day and never contains the IP', () => {
    const a = visitorHash('s', '203.0.113.9', UA_PC, '2026-11-03');
    expect(a).toHaveLength(32);
    expect(a).not.toContain('203');
    expect(visitorHash('s', '203.0.113.9', UA_PC, '2026-11-04')).not.toBe(a);
  });

  it('counts today live: visits, visitors, page views, bounces, breakdowns and event properties', async () => {
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
    const v = await visitors(db, '7d', 'day', true);
    expect(v.periods.today).toMatchObject({ visits: 2, visitors: 2, pageviews: 3 });
    expect(v.stats).toMatchObject({ visits: 2, visitors: 2, pageviews: 3, bounces: 1 });
    expect(v.stats.totaltime).toBe(60); // 30 s per visit
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
    expect(await eventValues(db, '7d', 'stream_open', 'id')).toEqual([{ value: 'abc', total: 2 }]);
    expect(await activeNow(db)).toBe(2);
  });

  it('rolls finished days into daily totals, and the totals match the live numbers', async () => {
    await visit('old1', UA_PC, '1.1.1.1', ['/', '/arts'], [{ t: 'art_open', x: { id: 'kv-5th-fes' } }], 3);
    await visit('old2', UA_PHONE, '2.2.2.2', ['/clips'], [], 2);
    await visit('now', UA_PHONE, '3.3.3.3', ['/']);
    const before = await visitors(db, '7d', 'day', false); // computes live (rolls up first, too)
    _resetRollupMemo();
    const r = await rollupIfStale(db, { force: true });
    expect(r).toMatchObject({ to: addDays(localDay(), -1) });
    const rolled = rows<{ n: number }>(
      await db.execute(sql`select count(*)::int as n from analytics_daily where metric = '_rolled'`),
    )[0]!.n;
    expect(rolled).toBeGreaterThanOrEqual(3);
    const after = await visitors(db, '7d', 'day', false);
    expect(after.stats).toEqual(before.stats);
    expect(after.stats).toMatchObject({ visits: 3, pageviews: 4 });
    expect(await eventValues(db, '7d', 'art_open', 'id')).toEqual([{ value: 'kv-5th-fes', total: 1 }]);
    // a second roll-up changes nothing
    _resetRollupMemo();
    await rollupIfStale(db, { force: true });
    expect((await visitors(db, '7d', 'day', false)).stats).toEqual(before.stats);
  });

  it('only production traffic counts', async () => {
    const list = parseBeacon(
      { v: 'visit-dev12345', e: [{ t: 'page_view', p: '/' }] },
      { ...ctx(UA_PC, '9.9.9.9'), environment: 'preview' },
    );
    await insertEvents(db, list);
    expect((await visitors(db, '7d', 'day', false)).stats.visits).toBe(0);
  });
});
