/** board.report (EXECUTIONPLAN §12.5): insert + auto-hide in one statement. Always answers { ok: true }. */
import { sql } from 'drizzle-orm';
import { rows } from '../db/types';
import { getSettings } from '../settings';
import { verifyTurnstile } from '../security/turnstile';
import { ipHash } from '../security/iphash';
import { alertLater } from '../alerts';
import type { BoardDeps } from './types';

export const REPORT_REASONS = ['spam', 'hate', 'sexual', 'personal_info', 'impersonation', 'other'] as const;
export type ReportReason = (typeof REPORT_REASONS)[number];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function reportNote(
  input: { messageId: string; reason: ReportReason; note?: string; turnstileToken: string },
  deps: BoardDeps,
): Promise<{ ok: true } | { ok: false; code: 'BAD_REQUEST' | 'BOT' | 'RATE' }> {
  const { db } = deps;
  if (
    !UUID.test(input.messageId) ||
    !REPORT_REASONS.includes(input.reason) ||
    (input.note && input.note.length > 200)
  )
    return { ok: false, code: 'BAD_REQUEST' };
  const ts = await verifyTurnstile({
    secret: deps.turnstileSecret,
    token: input.turnstileToken,
    ip: deps.clientIp,
    hostnames: deps.hostnames,
    fetchImpl: deps.fetchImpl,
  });
  if (!ts.ok) return { ok: false, code: 'BOT' };
  const s = await getSettings(db);
  const hash = ipHash(deps.ipSecret, deps.clientIp, deps.now?.());
  const [rate] = rows<{ n: number }>(
    await db.execute(
      sql`SELECT count(*)::int AS n FROM reports WHERE reporter_hash = ${hash} AND created_at > now() - interval '1 hour'`,
    ),
  );
  if ((rate?.n ?? 0) >= s.rate_report_hour) return { ok: false, code: 'RATE' };
  // reporting your own note succeeds quietly but isn't counted
  const [own] = rows<{ n: number }>(
    await db.execute(
      sql`SELECT count(*)::int AS n FROM messages WHERE id = ${input.messageId} AND ip_hash = ${hash}`,
    ),
  );
  if ((own?.n ?? 0) > 0) return { ok: true };

  const note =
    input.note
      ?.normalize('NFC')
      .replace(/[\u0000-\u001F\u007F​-‏‪-‮⁦-⁩]/g, ' ')
      .trim()
      .slice(0, 200) || null;
  const [res] = rows<{ crew_no: number; status: string; report_count: number }>(
    await db.execute(sql`
      WITH ins AS (
        INSERT INTO reports (message_id, reason, note, reporter_hash)
        SELECT ${input.messageId}, ${input.reason}::report_reason, ${note}, ${hash}
        WHERE EXISTS (SELECT 1 FROM messages WHERE id = ${input.messageId} AND status = 'visible')
        ON CONFLICT (message_id, reporter_hash) DO NOTHING
        RETURNING message_id
      )
      UPDATE messages m
      SET report_count = m.report_count + 1,
          status = CASE
            WHEN m.report_count + 1 >= (CASE WHEN m.approved_at IS NULL THEN ${s.report_threshold}::int ELSE ${s.rereport_threshold}::int END)
            THEN 'under_review'::message_status ELSE m.status END
      FROM ins
      WHERE m.id = ins.message_id
      RETURNING m.crew_no, m.status, m.report_count`),
  );
  if (res?.status === 'under_review') {
    const [reasons] = rows<{ r: string }>(
      await db.execute(
        sql`SELECT string_agg(reason || ' ×' || n, ', ') AS r FROM (SELECT reason, count(*) n FROM reports WHERE message_id = ${input.messageId} AND resolved_at IS NULL GROUP BY reason ORDER BY n DESC) x`,
      ),
    );
    alertLater(
      deps.discordWebhook,
      `⚠️ Note #${res.crew_no} hidden after ${res.report_count} reports (${reasons?.r ?? ''}) · ${deps.siteUrl}/keeper/queue`,
    );
  }
  return { ok: true };
}
