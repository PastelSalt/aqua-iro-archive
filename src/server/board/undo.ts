/** board.undo (EXECUTIONPLAN §12.6): the poster removes their own note within 10 minutes. */
import { sql } from 'drizzle-orm';
import { rows } from '../db/types';
import { sha256 } from '../security/iphash';
import type { DB } from '../db/types';

export async function undoNote(
  input: { messageId: string; undoToken: string },
  db: DB,
): Promise<{ ok: true } | { ok: false; code: 'UNDO_EXPIRED' }> {
  if (!input.undoToken || input.undoToken.length > 100) return { ok: false, code: 'UNDO_EXPIRED' };
  const r = rows<{ id: string }>(
    await db.execute(sql`
      UPDATE messages SET status = 'removed', removed_at = now(), removed_reason = 'undo'
      WHERE id = ${input.messageId} AND owner_token_hash = ${sha256(input.undoToken)}
        AND created_at > now() - interval '10 minutes' AND status <> 'removed'
      RETURNING id`),
  );
  return r.length ? { ok: true } : { ok: false, code: 'UNDO_EXPIRED' };
}
