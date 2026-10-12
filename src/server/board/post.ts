/** board.post pipeline (EXECUTIONPLAN §12.4). Cheap checks first; every check runs before the insert. */
import { randomBytes } from 'node:crypto';
import { sql } from 'drizzle-orm';
import { rows } from '../db/types';
import { getSettings, setSetting } from '../settings';
import { verifyTurnstile } from '../security/turnstile';
import { ipHash, sha256 } from '../security/iphash';
import { alertLater } from '../alerts';
import { logError } from '../log';
import { loadTerms, runFilter } from './filter';
import { checkText, compareForm } from '../../lib/text/normalize';
import type { BoardDeps, PostResult } from './types';

export async function postNote(
  input: { body: string; turnstileToken: string },
  deps: BoardDeps,
): Promise<PostResult> {
  const { db } = deps;
  // 1. shape
  if (
    typeof input.body !== 'string' ||
    input.body.length > 2000 ||
    typeof input.turnstileToken !== 'string' ||
    input.turnstileToken.length > 2048
  )
    return { ok: false, code: 'BAD_REQUEST' };
  // 2. paused
  const s = await getSettings(db);
  if (s.posting_paused) return { ok: false, code: 'PAUSED' };
  // 3. Turnstile
  const ts = await verifyTurnstile({
    secret: deps.turnstileSecret,
    token: input.turnstileToken,
    ip: deps.clientIp,
    hostnames: deps.hostnames,
    fetchImpl: deps.fetchImpl,
  });
  if (!ts.ok) return { ok: false, code: 'BOT' };
  // 4–6. clean, length, links, personal info
  const checked = checkText(input.body, { maxLen: s.max_len, maxLines: s.max_lines });
  if (!checked.ok) return { ok: false, code: checked.code };
  const body = checked.text;
  // 7. IP hash
  const hash = ipHash(deps.ipSecret, deps.clientIp, deps.now?.());
  // 8. rate limit + raid detection in one query
  const [rate] = rows<{ m10: number; d1: number; site5: number }>(
    await db.execute(sql`
      SELECT
        count(*) FILTER (WHERE ip_hash = ${hash} AND created_at > now() - interval '10 minutes')::int AS m10,
        count(*) FILTER (WHERE ip_hash = ${hash} AND created_at > now() - interval '24 hours')::int AS d1,
        count(*) FILTER (WHERE created_at > now() - interval '5 minutes')::int AS site5
      FROM messages WHERE created_at > now() - interval '24 hours'`),
  );
  if ((rate?.m10 ?? 0) >= s.rate_post_10m || (rate?.d1 ?? 0) >= s.rate_post_day)
    return { ok: false, code: 'RATE' };
  let newcomerHold = s.newcomer_hold;
  if ((rate?.site5 ?? 0) >= s.raid_posts_5m && !newcomerHold) {
    newcomerHold = true;
    await setSetting(db, 'newcomer_hold', true);
    await setSetting(db, 'newcomer_hold_auto_at', new Date().toISOString());
    alertLater(
      deps.discordWebhook,
      `🚨 Raid guard: ${rate!.site5} notes in 5 min — newcomer hold ON · ${deps.siteUrl}/keeper/settings`,
    );
  }
  // 9. duplicates: same text in the last 24 h (anyone) or ever from this IP hash
  const bodyHash = sha256(compareForm(body));
  const [dup] = rows<{ n: number }>(
    await db.execute(sql`
      SELECT count(*)::int AS n FROM messages
      WHERE body_hash = ${bodyHash} AND (created_at > now() - interval '24 hours' OR ip_hash = ${hash})`),
  );
  if ((dup?.n ?? 0) > 0) return { ok: false, code: 'DUPLICATE' };
  // 10. word filter
  const f = runFilter(body, await loadTerms(db));
  if (f.action === 'reject') return { ok: false, code: 'FILTER' };
  // 11. newcomer / raid hold
  let status: 'visible' | 'held' = 'visible';
  let heldReason: string | null = null;
  if (f.action === 'hold') [status, heldReason] = ['held', f.reason];
  else if (newcomerHold)
    [status, heldReason] = ['held', s.newcomer_hold && rate!.site5 < s.raid_posts_5m ? 'newcomer' : 'raid'];
  // 12. insert
  const token = randomBytes(32).toString('base64url');
  try {
    const [row] = rows<{
      id: string;
      crew_no: number;
      status: 'visible' | 'held';
      created_at: string | Date;
    }>(
      await db.execute(sql`
        INSERT INTO messages (body, body_hash, status, held_reason, ip_hash, owner_token_hash)
        VALUES (${body}, ${bodyHash}, ${status}, ${heldReason}, ${hash}, ${sha256(token)})
        RETURNING id, crew_no, status, created_at`),
    );
    const createdAt = new Date(row!.created_at).toISOString();
    // 13. alert the keeper for held notes (crew number + reason only)
    if (status === 'held')
      alertLater(
        deps.discordWebhook,
        `⚓ Note #${row!.crew_no} held (${heldReason}) — review: ${deps.siteUrl}/keeper/queue?tab=held`,
      );
    // 14. respond
    return {
      ok: true,
      id: row!.id,
      crewNo: Number(row!.crew_no),
      status: row!.status,
      createdAt,
      undoToken: token,
      undoUntil: new Date(new Date(createdAt).getTime() + 10 * 60_000).toISOString(),
    };
  } catch (e) {
    await logError(db, 'board.post', e);
    return { ok: false, code: 'INTERNAL' };
  }
}
