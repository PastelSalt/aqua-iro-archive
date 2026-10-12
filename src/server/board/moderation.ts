/**
 * Keeper moderation (EXECUTIONPLAN §11.3 / §15.3). Every mutation writes an admin_actions row in the same
 * transaction. Rows are never hard-deleted except by an explicit, typed-confirmation Purge.
 */
import { sql } from 'drizzle-orm';
import { rows, type DB } from '../db/types';

type Tx = Pick<DB, 'execute'> & { transaction?: DB['transaction'] };
async function inTx<T>(db: DB, fn: (tx: Tx) => Promise<T>): Promise<T> {
  // neon-http has no interactive transactions; the Pool / PGlite drivers do
  try {
    return await db.transaction(async (tx) => fn(tx as unknown as Tx));
  } catch (e) {
    if (String((e as Error).message).includes('No transactions support')) return fn(db);
    throw e;
  }
}
/** `IN ($1::uuid, $2::uuid, …)` — drizzle expands JS arrays into parameter lists, not Postgres arrays */
const idList = (ids: string[]) =>
  sql`(${sql.join(
    ids.map((i) => sql`${i}::uuid`),
    sql`, `,
  )})`;
const audit = (
  tx: Tx,
  actor: string,
  action: string,
  messageId: string | null,
  detail: Record<string, unknown>,
) =>
  tx.execute(
    sql`INSERT INTO admin_actions (actor_id, action, message_id, detail) VALUES (${actor}, ${action}::admin_action_kind, ${messageId}, ${JSON.stringify(detail)}::jsonb)`,
  );

export async function approve(db: DB, actor: string, ids: string[]) {
  return inTx(db, async (tx) => {
    const r = rows<{ id: string; crew_no: number }>(
      await tx.execute(sql`UPDATE messages SET status = 'visible', report_count = 0, approved_at = now(), held_reason = NULL
        WHERE id IN ${idList(ids)} AND status IN ('held', 'under_review', 'visible') RETURNING id, crew_no`),
    );
    await tx.execute(
      sql`UPDATE reports SET resolved_at = now(), outcome = 'dismissed' WHERE message_id IN ${idList(ids)} AND resolved_at IS NULL`,
    );
    for (const m of r)
      await audit(tx, actor, ids.length > 1 ? 'bulk_approve' : 'approve', m.id, { crewNo: m.crew_no });
    return r.length;
  });
}

export async function remove(db: DB, actor: string, ids: string[], reason: string) {
  if (!reason.trim()) throw new Error('A reason is required');
  return inTx(db, async (tx) => {
    const r = rows<{ id: string; crew_no: number }>(
      await tx.execute(sql`UPDATE messages SET status = 'removed', removed_at = now(), removed_reason = ${reason.slice(0, 300)}
        WHERE id IN ${idList(ids)} AND status <> 'removed' RETURNING id, crew_no`),
    );
    await tx.execute(
      sql`UPDATE reports SET resolved_at = now(), outcome = 'upheld' WHERE message_id IN ${idList(ids)} AND resolved_at IS NULL`,
    );
    for (const m of r)
      await audit(tx, actor, ids.length > 1 ? 'bulk_remove' : 'remove', m.id, { crewNo: m.crew_no, reason });
    return r.length;
  });
}

export async function restore(db: DB, actor: string, id: string) {
  return inTx(db, async (tx) => {
    const r = rows<{ id: string; crew_no: number }>(
      await tx.execute(
        sql`UPDATE messages SET status = 'visible', removed_at = NULL, removed_reason = NULL WHERE id = ${id} AND status = 'removed' RETURNING id, crew_no`,
      ),
    );
    if (r[0]) await audit(tx, actor, 'restore', id, { crewNo: r[0].crew_no });
    return r.length;
  });
}

/** Hard delete for a verified privacy request: the caller must type the crew number. */
export async function purge(db: DB, actor: string, id: string, typedCrewNo: number) {
  return inTx(db, async (tx) => {
    const [m] = rows<{ crew_no: number }>(
      await tx.execute(sql`SELECT crew_no FROM messages WHERE id = ${id}`),
    );
    if (!m || Number(m.crew_no) !== typedCrewNo) throw new Error('Crew number does not match');
    await audit(tx, actor, 'purge', null, { crewNo: m.crew_no });
    await tx.execute(sql`DELETE FROM messages WHERE id = ${id}`);
    return 1;
  });
}

export type QueueItem = {
  id: string;
  crew_no: number;
  body: string;
  status: string;
  held_reason: string | null;
  created_at: string;
  approved_at: string | null;
  report_count: number;
  reasons: { reason: string; n: number }[] | null;
  notes: string[] | null;
};

export async function queue(db: DB, tab: 'reported' | 'held'): Promise<QueueItem[]> {
  const where =
    tab === 'held'
      ? sql`m.status = 'held'`
      : sql`(m.status = 'under_review' OR (m.status = 'visible' AND EXISTS (SELECT 1 FROM reports r WHERE r.message_id = m.id AND r.resolved_at IS NULL)))`;
  return rows<QueueItem>(
    await db.execute(sql`
      SELECT m.id, m.crew_no, m.body, m.status, m.held_reason, m.created_at, m.approved_at, m.report_count,
        (SELECT json_agg(json_build_object('reason', reason, 'n', n) ORDER BY n DESC) FROM (SELECT reason, count(*)::int n FROM reports WHERE message_id = m.id AND resolved_at IS NULL GROUP BY reason) x) AS reasons,
        (SELECT json_agg(note) FROM reports WHERE message_id = m.id AND resolved_at IS NULL AND note IS NOT NULL) AS notes
      FROM messages m WHERE ${where}
      ORDER BY m.report_count DESC, m.crew_no DESC LIMIT 200`),
  );
}

export async function notesList(
  db: DB,
  f: { status?: string; q?: string; from?: string; to?: string; limit?: number },
) {
  const status =
    f.status && ['visible', 'held', 'under_review', 'removed'].includes(f.status) ? f.status : null;
  const crew = f.q && /^#?\d+$/.test(f.q.trim()) ? Number(f.q.replace('#', '')) : null;
  const text = f.q && crew === null ? `%${f.q.replace(/[%_\\]/g, (c) => `\\${c}`)}%` : null;
  return rows<QueueItem & { removed_reason: string | null }>(
    await db.execute(sql`
      SELECT id, crew_no, body, status, held_reason, created_at, approved_at, report_count, removed_reason
      FROM messages
      WHERE (${status}::text IS NULL OR status::text = ${status})
        AND (${crew}::int IS NULL OR crew_no = ${crew})
        AND (${text}::text IS NULL OR body ILIKE ${text})
        AND (${f.from ?? null}::date IS NULL OR created_at >= ${f.from ?? null}::date)
        AND (${f.to ?? null}::date IS NULL OR created_at < (${f.to ?? null}::date + 1))
      ORDER BY crew_no DESC LIMIT ${Math.min(500, f.limit ?? 100)}`),
  );
}

export async function auditList(db: DB, action?: string, limit = 300) {
  return rows<{
    id: number;
    actor_id: string | null;
    action: string;
    message_id: string | null;
    detail: Record<string, unknown> | null;
    created_at: string;
    crew_no: number | null;
  }>(
    await db.execute(sql`
      SELECT a.id, a.actor_id, a.action, a.message_id, a.detail, a.created_at, m.crew_no
      FROM admin_actions a LEFT JOIN messages m ON m.id = a.message_id
      WHERE (${action ?? null}::text IS NULL OR a.action::text = ${action ?? null})
      ORDER BY a.created_at DESC LIMIT ${limit}`),
  );
}

export async function boardStats(db: DB, days: number) {
  const [now] = rows<{ held: number; review: number; removed30: number; errors24: number }>(
    await db.execute(sql`SELECT
      (SELECT count(*)::int FROM messages WHERE status = 'held') AS held,
      (SELECT count(*)::int FROM messages WHERE status = 'under_review') AS review,
      (SELECT count(*)::int FROM messages WHERE status = 'removed' AND removed_at > now() - interval '30 days') AS removed30,
      (SELECT count(*)::int FROM app_errors WHERE at > now() - interval '24 hours') AS errors24`),
  );
  const series = rows<{ day: string; notes: number; reports: number }>(
    await db.execute(sql`
      SELECT to_char(d, 'YYYY-MM-DD') AS day,
        (SELECT count(*)::int FROM messages WHERE created_at >= d AND created_at < d + interval '1 day') AS notes,
        (SELECT count(*)::int FROM reports WHERE created_at >= d AND created_at < d + interval '1 day') AS reports
      FROM generate_series(date_trunc('day', now()) - (${days - 1} || ' days')::interval, date_trunc('day', now()), interval '1 day') d`),
  );
  return { ...now!, series };
}
