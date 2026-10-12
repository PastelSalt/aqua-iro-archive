import { beforeEach, describe, expect, it } from 'vitest';
import { sql } from 'drizzle-orm';
import { freshDb, deps } from './helpers';
import { postNote } from '../../src/server/board/post';
import { reportNote } from '../../src/server/board/report';
import {
  approve,
  remove,
  restore,
  purge,
  queue,
  notesList,
  auditList,
} from '../../src/server/board/moderation';
import { rows, type DB } from '../../src/server/db/types';

let db: DB;
beforeEach(async () => {
  ({ db } = await freshDb());
});
const post = async (body: string, ip: string) => {
  const r = await postNote({ body, turnstileToken: 'ok' }, deps(db, ip));
  if (!r.ok) throw new Error(r.code);
  return r;
};

describe('keeper moderation (§11.3)', () => {
  it('approve resets reports, dismisses them and writes an audit row', async () => {
    const n = await post('note to check', '1.1.1.1');
    for (const ip of ['2.2.2.2', '3.3.3.3', '4.4.4.4'])
      await reportNote({ messageId: n.id, reason: 'spam', turnstileToken: 'ok' }, deps(db, ip));
    expect((await queue(db, 'reported')).map((q) => q.crew_no)).toEqual([n.crewNo]);
    expect(await approve(db, 'admin', [n.id])).toBe(1);
    const [m] = rows<{ status: string; report_count: number }>(
      await db.execute(sql`SELECT status, report_count FROM messages`),
    );
    expect(m).toEqual({ status: 'visible', report_count: 0 });
    const [r] = rows<{ open: number }>(
      await db.execute(sql`SELECT count(*) FILTER (WHERE resolved_at IS NULL)::int AS open FROM reports`),
    );
    expect(r!.open).toBe(0);
    expect((await auditList(db)).map((a) => a.action)).toContain('approve');
    expect(await queue(db, 'reported')).toHaveLength(0);
  });
  it('remove needs a reason, bulk-removes, and restore brings a note back', async () => {
    const a = await post('spam one', '5.5.5.1');
    const b = await post('spam two', '5.5.5.2');
    await expect(remove(db, 'admin', [a.id], '  ')).rejects.toThrow();
    expect(await remove(db, 'admin', [a.id, b.id], 'Spam')).toBe(2);
    expect((await auditList(db, 'bulk_remove')).length).toBe(2);
    expect(await restore(db, 'admin', a.id)).toBe(1);
    expect((await notesList(db, { status: 'visible' })).map((x) => x.id)).toEqual([a.id]);
  });
  it('held notes show in the Held tab and approve makes them public', async () => {
    const h = await post('中の人の話', '6.6.6.6');
    expect(h.status).toBe('held');
    expect((await queue(db, 'held')).map((q) => q.id)).toEqual([h.id]);
    await approve(db, 'admin', [h.id]);
    expect((await queue(db, 'held')).length).toBe(0);
  });
  it('purge hard-deletes only with the right crew number, and logs it', async () => {
    const n = await post('please delete me', '7.7.7.7');
    await expect(purge(db, 'admin', n.id, n.crewNo + 1)).rejects.toThrow(/does not match/);
    expect(await purge(db, 'admin', n.id, n.crewNo)).toBe(1);
    expect(await notesList(db, {})).toHaveLength(0);
    expect((await auditList(db, 'purge'))[0]!.detail).toEqual({ crewNo: n.crewNo });
    // crew numbers are never reused
    const next = await post('a new note', '8.8.8.8');
    expect(next.crewNo).toBe(n.crewNo + 1);
  });
  it('notes search finds by crew number and by text (wildcards escaped)', async () => {
    await post('100% kind words', '9.9.9.1');
    const b = await post('another one', '9.9.9.2');
    expect((await notesList(db, { q: `#${b.crewNo}` })).map((x) => x.id)).toEqual([b.id]);
    expect((await notesList(db, { q: '100%' })).length).toBe(1);
    expect((await notesList(db, { q: '%' })).length).toBe(1);
  });
});
