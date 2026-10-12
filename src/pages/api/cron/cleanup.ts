/** Daily cron (EXECUTIONPLAN §12.7). Vercel sends `Authorization: Bearer $CRON_SECRET`. */
import type { APIRoute } from 'astro';
import { timingSafeEqual } from 'node:crypto';
import { CRON_SECRET, DISCORD_WEBHOOK_URL } from 'astro:env/server';
import { db } from '../../../server/db/http';
import { runCleanup, digestText } from '../../../server/board/cleanup';
import { sendAlert } from '../../../server/alerts';
import { logError } from '../../../server/log';
import { umamiVisitors24h } from '../../../server/umami';

export const prerender = false;

function authorized(header: string | null): boolean {
  if (!CRON_SECRET || !header) return false;
  const a = Buffer.from(header);
  const b = Buffer.from(`Bearer ${CRON_SECRET}`);
  return a.length === b.length && timingSafeEqual(a, b);
}

export const GET: APIRoute = async ({ request }) => {
  if (!authorized(request.headers.get('authorization'))) return new Response('Unauthorized', { status: 401 });
  try {
    const out = await runCleanup(db());
    const visitors = await umamiVisitors24h().catch(() => null);
    await sendAlert(DISCORD_WEBHOOK_URL, digestText(out.counts, visitors));
    if (out.resumed)
      await sendAlert(
        DISCORD_WEBHOOK_URL,
        '⚓ Newcomer hold switched off by the daily cleanup (24 h quiet, nothing held).',
      );
    return Response.json({ ok: true, counts: out.counts });
  } catch (e) {
    await logError(db(), 'cron/cleanup', e);
    await sendAlert(DISCORD_WEBHOOK_URL, `🛠 Cron cleanup failed: ${(e as Error).message}`);
    return Response.json({ ok: false }, { status: 500 });
  }
};
