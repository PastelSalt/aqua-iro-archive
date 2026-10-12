import { beforeEach, describe, expect, it } from 'vitest';
import { sql } from 'drizzle-orm';
import { freshDb, deps } from './helpers';
import { postNote } from '../../src/server/board/post';
import { reportNote } from '../../src/server/board/report';
import { undoNote } from '../../src/server/board/undo';
import { listNotes, boardCounts } from '../../src/server/board/list';
import { setSetting, _resetSettingsCache } from '../../src/server/settings';
import { runCleanup } from '../../src/server/board/cleanup';
import { rows, type DB } from '../../src/server/db/types';

let db: DB;
beforeEach(async () => {
  ({ db } = await freshDb());
});
const post = (body: string, ip?: string, token = 'ok-token') =>
  postNote({ body, turnstileToken: token }, deps(db, ip));

describe('board.post (§12.4)', () => {
  it('happy path: visible note with a crew number and an undo token', async () => {
    const r = await post('あくたん、六年間ありがとう！');
    expect(r).toMatchObject({ ok: true, crewNo: 1, status: 'visible' });
    const r2 = await post('Thank you for every stream', '198.51.100.2');
    expect(r2).toMatchObject({ ok: true, crewNo: 2 });
    const list = await listNotes(db, { sort: 'new', limit: 30 });
    expect(list.items.map((n) => n.crewNo)).toEqual([2, 1]);
    expect(Object.keys(list.items[0]!)).toEqual(['id', 'crewNo', 'status', 'body', 'createdAt']);
    expect(await boardCounts(db)).toEqual({ total: 2, nextCrewNo: 3 });
  });
  it('rejects each failure with its code', async () => {
    expect(await post('hello', undefined, 'bad-token')).toEqual({ ok: false, code: 'BOT' });
    expect(await post('   ')).toEqual({ ok: false, code: 'EMPTY' });
    expect(await post('あ'.repeat(301))).toEqual({ ok: false, code: 'LENGTH' });
    expect(await post('go to example.com')).toEqual({ ok: false, code: 'LINK' });
    expect(await post('DM me @someone_here')).toEqual({ ok: false, code: 'PERSONAL' });
    expect(await post('⚓'.repeat(21))).toEqual({ ok: false, code: 'EMOJI' });
    expect(await post('x'.repeat(2001))).toEqual({ ok: false, code: 'BAD_REQUEST' });
  });
  it('blocks duplicates (24 h, anyone) and rate-limits per IP hash', async () => {
    expect((await post('同じ言葉です')).ok).toBe(true);
    expect(await post('おなじ　ことばです！', '198.51.100.9')).toMatchObject({ ok: true }); // different text
    expect(await post('同じ言葉です。', '198.51.100.10')).toEqual({ ok: false, code: 'DUPLICATE' });
    expect((await post('two')).ok).toBe(true);
    expect((await post('three')).ok).toBe(true);
    expect(await post('four')).toEqual({ ok: false, code: 'RATE' }); // 3 per 10 min
  });
  it('holds notes that hit the word list and rejects "reject" terms', async () => {
    expect(await post('中の人の話をしよう')).toMatchObject({ ok: true, status: 'held' });
    expect(await post('add me on line.me/abc')).toMatchObject({ ok: false }); // link rule catches it first
    await db.execute(
      sql`INSERT INTO blocked_terms (term, kind, action) VALUES ('spamword', 'substring', 'reject')`,
    );
    const { _resetTermsCache } = await import('../../src/server/board/filter');
    _resetTermsCache();
    expect(await post('buy SPAMWORD now', '198.51.100.3')).toEqual({ ok: false, code: 'FILTER' });
    const list = await listNotes(db, { sort: 'new', limit: 30 });
    expect(list.items).toHaveLength(0); // held notes never reach the public list
  });
  it('raid guard: too many site-wide posts in 5 min turns on newcomer hold', async () => {
    await setSetting(db, 'raid_posts_5m', 5);
    for (let i = 0; i < 5; i++)
      expect((await post(`note number ${i}`, `198.51.100.${20 + i}`)).ok).toBe(true);
    const r = await post('one more', '198.51.100.99');
    expect(r).toMatchObject({ ok: true, status: 'held' });
    _resetSettingsCache();
    const [s] = rows<{ value: unknown }>(
      await db.execute(sql`SELECT value FROM settings WHERE key = 'newcomer_hold'`),
    );
    expect(s!.value).toBe(true);
  });
  it('paused board refuses posts', async () => {
    await setSetting(db, 'posting_paused', true);
    expect(await post('hello')).toEqual({ ok: false, code: 'PAUSED' });
  });
  it('stores text as typed (escaped later), never as HTML', async () => {
    const xss = '<img src=x onerror=alert(1)> "><svg/onload=alert(1)>';
    const r = await post(xss);
    expect(r.ok).toBe(true);
    const list = await listNotes(db, { sort: 'new', limit: 1 });
    expect(list.items[0]!.body).toBe(xss);
  });
});

describe('board.report (§12.5)', () => {
  it('auto-hides at 3 distinct reporters, and at 6 after an approval', async () => {
    const r = await post('a perfectly kind note');
    if (!r.ok) throw new Error('post failed');
    const rep = (ip: string) =>
      reportNote({ messageId: r.id, reason: 'hate', turnstileToken: 'ok' }, deps(db, ip));
    expect(await rep('10.0.0.1')).toEqual({ ok: true });
    expect(await rep('10.0.0.1')).toEqual({ ok: true }); // duplicate reporter: not counted
    expect(await rep('10.0.0.2')).toEqual({ ok: true });
    let [m] = rows<{ status: string; report_count: number }>(
      await db.execute(sql`SELECT status, report_count FROM messages`),
    );
    expect(m).toEqual({ status: 'visible', report_count: 2 });
    await rep('10.0.0.3');
    [m] = rows(await db.execute(sql`SELECT status, report_count FROM messages`));
    expect(m!.status).toBe('under_review');
    const list = await listNotes(db, { sort: 'new', limit: 5 });
    expect(list.items[0]).toMatchObject({ status: 'under_review', body: null }); // resting slip: no text
    // keeper approves → needs 6 reports to hide again
    await db.execute(sql`UPDATE messages SET status = 'visible', report_count = 0, approved_at = now()`);
    for (let i = 4; i <= 8; i++) await rep(`10.0.0.${i}`);
    [m] = rows(await db.execute(sql`SELECT status, report_count FROM messages`));
    expect(m).toEqual({ status: 'visible', report_count: 5 });
    await rep('10.0.0.9');
    [m] = rows(await db.execute(sql`SELECT status FROM messages`));
    expect(m!.status).toBe('under_review');
  });
  it('reporting your own note succeeds quietly but is not counted', async () => {
    const r = await post('my own note', '10.1.1.1');
    if (!r.ok) throw new Error();
    expect(
      await reportNote({ messageId: r.id, reason: 'spam', turnstileToken: 'ok' }, deps(db, '10.1.1.1')),
    ).toEqual({ ok: true });
    const [m] = rows<{ report_count: number }>(await db.execute(sql`SELECT report_count FROM messages`));
    expect(m!.report_count).toBe(0);
  });
  it('requires a valid reason', async () => {
    const r = await post('note');
    if (!r.ok) throw new Error();
    expect(
      await reportNote(
        { messageId: r.id, reason: 'nope' as never, turnstileToken: 'ok' },
        deps(db, '10.2.2.2'),
      ),
    ).toEqual({ ok: false, code: 'BAD_REQUEST' });
  });
});

describe('board.undo (§12.6)', () => {
  it('removes your own note within 10 minutes, not after', async () => {
    const a = await post('typo note');
    const b = await post('another note');
    if (!a.ok || !b.ok) throw new Error();
    expect(await undoNote({ messageId: a.id, undoToken: 'wrong' }, db)).toEqual({
      ok: false,
      code: 'UNDO_EXPIRED',
    });
    expect(await undoNote({ messageId: a.id, undoToken: a.undoToken }, db)).toEqual({ ok: true });
    await db.execute(sql`UPDATE messages SET created_at = now() - interval '11 minutes' WHERE id = ${b.id}`);
    expect(await undoNote({ messageId: b.id, undoToken: b.undoToken }, db)).toEqual({
      ok: false,
      code: 'UNDO_EXPIRED',
    });
    const list = await listNotes(db, { sort: 'new', limit: 5 });
    expect(list.items.map((n) => n.id)).toEqual([b.id]); // removed notes are skipped, numbers never reused
  });
});

describe('cron cleanup (§12.7)', () => {
  it('nulls old IP hashes and undo tokens, prunes old errors, turns off an idle raid hold', async () => {
    const a = await post('old note');
    if (!a.ok) throw new Error();
    await db.execute(sql`UPDATE messages SET created_at = now() - interval '31 days'`);
    await db.execute(
      sql`INSERT INTO app_errors (route, message, at) VALUES ('x', 'old', now() - interval '15 days')`,
    );
    await setSetting(db, 'newcomer_hold', true);
    await setSetting(db, 'newcomer_hold_auto_at', new Date(Date.now() - 25 * 3600_000).toISOString());
    const out = await runCleanup(db);
    expect(out.ok).toBe(true);
    const [m] = rows<{ ip_hash: string | null; owner_token_hash: string | null }>(
      await db.execute(sql`SELECT ip_hash, owner_token_hash FROM messages`),
    );
    expect(m).toEqual({ ip_hash: null, owner_token_hash: null });
    const [e] = rows<{ n: number }>(await db.execute(sql`SELECT count(*)::int n FROM app_errors`));
    expect(e!.n).toBe(0);
    const [h] = rows<{ value: unknown }>(
      await db.execute(sql`SELECT value FROM settings WHERE key = 'newcomer_hold'`),
    );
    expect(h!.value).toBe(false);
  });
});

describe('random sort', () => {
  it('is stable per seed and pages never repeat', async () => {
    for (let i = 0; i < 9; i++) await post(`note ${i} text`, `192.0.2.${i}`);
    const p1 = await listNotes(db, { sort: 'random', seed: 7, cursor: 0, limit: 4 });
    const p2 = await listNotes(db, { sort: 'random', seed: 7, cursor: 1, limit: 4 });
    const again = await listNotes(db, { sort: 'random', seed: 7, cursor: 0, limit: 4 });
    expect(again.items.map((x) => x.id)).toEqual(p1.items.map((x) => x.id));
    const ids = [...p1.items, ...p2.items].map((x) => x.id);
    expect(new Set(ids).size).toBe(8);
  });
});
