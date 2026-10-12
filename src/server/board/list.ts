/** GET /api/messages query (EXECUTIONPLAN §12.3). Never returns hashes, report counts or held/removed notes. */
import { sql } from 'drizzle-orm';
import { rows } from '../db/types';
import type { DB } from '../db/types';
import type { PublicNote } from './types';

type Raw = {
  id: string;
  crew_no: number;
  status: 'visible' | 'under_review';
  body: string | null;
  created_at: string | Date;
};
const toNote = (r: Raw): PublicNote => ({
  id: r.id,
  crewNo: Number(r.crew_no),
  status: r.status,
  body: r.status === 'visible' ? r.body : null,
  createdAt: new Date(r.created_at).toISOString(),
});

export async function listNotes(
  db: DB,
  q: { sort: 'new' | 'random'; cursor?: number | null; seed?: number; limit: number },
) {
  const limit = Math.min(60, Math.max(1, q.limit));
  let list: Raw[];
  if (q.sort === 'random') {
    const page = Math.max(0, q.cursor ?? 0);
    list = rows<Raw>(
      await db.execute(sql`
        SELECT id, crew_no, status, created_at, CASE WHEN status = 'visible' THEN body END AS body
        FROM messages WHERE status IN ('visible', 'under_review')
        ORDER BY md5(id::text || ${String(q.seed ?? 1)}) LIMIT ${limit} OFFSET ${page * limit}`),
    );
  } else {
    list = rows<Raw>(
      await db.execute(sql`
        SELECT id, crew_no, status, created_at, CASE WHEN status = 'visible' THEN body END AS body
        FROM messages WHERE status IN ('visible', 'under_review') AND (${q.cursor ?? null}::int IS NULL OR crew_no < ${q.cursor ?? null}::int)
        ORDER BY crew_no DESC LIMIT ${limit}`),
    );
  }
  const items = list.map(toNote);
  const nextCursor =
    items.length < limit ? null : q.sort === 'random' ? (q.cursor ?? 0) + 1 : items[items.length - 1]!.crewNo;
  return { items, nextCursor };
}

export async function boardCounts(db: DB): Promise<{ total: number; nextCrewNo: number }> {
  const [c] = rows<{ total: number }>(
    await db.execute(sql`SELECT count(*)::int AS total FROM messages WHERE status = 'visible'`),
  );
  // preview only; the real number comes from the sequence when the note lands (§11.4)
  const [m] = rows<{ last: number | null }>(await db.execute(sql`SELECT max(crew_no) AS last FROM messages`));
  return { total: c?.total ?? 0, nextCrewNo: Number(m?.last ?? 0) + 1 };
}
