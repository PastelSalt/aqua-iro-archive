/** Daily maintenance (EXECUTIONPLAN §12.7). Returns counts for the digest; the caller sends it. */
import { sql } from 'drizzle-orm';
import { rows, type DB } from '../db/types';
import { getSetting, setSetting } from '../settings';

export async function runCleanup(
  db: DB,
): Promise<{ ok: true; counts: Record<string, number>; resumed: boolean }> {
  const counts: Record<string, number> = {};
  const n = async (key: string, q: ReturnType<typeof sql>) => {
    counts[key] = rows(await db.execute(q)).length;
  };
  await n(
    'ipHashesCleared',
    sql`UPDATE messages SET ip_hash = NULL WHERE created_at < now() - interval '30 days' AND ip_hash IS NOT NULL RETURNING 1`,
  );
  await n(
    'undoTokensCleared',
    sql`UPDATE messages SET owner_token_hash = NULL WHERE created_at < now() - interval '10 minutes' AND owner_token_hash IS NOT NULL RETURNING 1`,
  );
  await n(
    'reporterHashesCleared',
    sql`UPDATE reports SET reporter_hash = NULL WHERE created_at < now() - interval '30 days' AND reporter_hash IS NOT NULL RETURNING 1`,
  );
  await n('errorsPruned', sql`DELETE FROM app_errors WHERE at < now() - interval '14 days' RETURNING 1`);
  await n('sessionsPruned', sql`DELETE FROM session WHERE expires_at < now() RETURNING 1`);
  await n('verificationsPruned', sql`DELETE FROM verification WHERE expires_at < now() RETURNING 1`);

  // raid hold switched on automatically > 24 h ago and nothing is waiting → switch it off
  let resumed = false;
  const autoAt = await getSetting<string | null>(db, 'newcomer_hold_auto_at');
  const hold = await getSetting<boolean>(db, 'newcomer_hold');
  if (hold && autoAt && Date.now() - new Date(autoAt).getTime() > 24 * 3600_000) {
    const [h] = rows<{ n: number }>(
      await db.execute(sql`SELECT count(*)::int AS n FROM messages WHERE status = 'held'`),
    );
    if ((h?.n ?? 0) === 0) {
      await setSetting(db, 'newcomer_hold', false);
      await setSetting(db, 'newcomer_hold_auto_at', null);
      await db.execute(
        sql`INSERT INTO admin_actions (action, detail) VALUES ('resume', ${JSON.stringify({ by: 'cron', what: 'newcomer_hold' })}::jsonb)`,
      );
      resumed = true;
    }
  }

  const [d] = rows<{ notes: number; held: number; review: number; reports: number; errors: number }>(
    await db.execute(sql`
      SELECT
        (SELECT count(*)::int FROM messages WHERE created_at > now() - interval '24 hours') AS notes,
        (SELECT count(*)::int FROM messages WHERE status = 'held') AS held,
        (SELECT count(*)::int FROM messages WHERE status = 'under_review') AS review,
        (SELECT count(*)::int FROM reports WHERE created_at > now() - interval '24 hours') AS reports,
        (SELECT count(*)::int FROM app_errors WHERE at > now() - interval '24 hours') AS errors`),
  );
  Object.assign(counts, d);
  await setSetting(db, 'last_cron_at', new Date().toISOString());
  return { ok: true, counts, resumed };
}

export function digestText(c: Record<string, number>, visitors: number | null): string {
  const v = visitors == null ? 'visitors n/a' : `${visitors.toLocaleString('en-US')} visitors`;
  return `📒 Last 24 h: ${c.notes ?? 0} notes · ${c.held ?? 0} held · ${c.review ?? 0} under review · ${c.reports ?? 0} reports · ${v} · ${c.errors ?? 0} errors`;
}
