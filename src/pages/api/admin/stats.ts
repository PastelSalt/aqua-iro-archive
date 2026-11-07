/**
 * GET /api/admin/stats?range=7d&unit=day[&full=1][&env=all] (docs/ANALYTICS-REBUILD-PLAN.md): the dashboard's and
 * the Visitors page's data in one request — board series, visitors (fixed periods, the chart series, the
 * breakdowns; `full` adds OS, language, 25 rows and the 7 × 24 grid; `env=all` adds preview and development
 * traffic) and the dashboard's top-5 engagement lists. Admin only (middleware).
 */
import type { APIRoute } from 'astro';
import { dbTx } from '../../../server/db/pool';
import { db } from '../../../server/db/http';
import { boardStats } from '../../../server/board/moderation';
import { rangeOf, visitors as siteVisitors } from '../../../server/analytics';
import { insights } from '../../../server/insights';

export const prerender = false;

export const GET: APIRoute = async ({ url, locals }) => {
  if (!locals.admin) return new Response('Unauthorized', { status: 401 });
  const q = url.searchParams;
  const range = rangeOf(q.get('range'), '7d');
  const unit = (['day', 'week', 'month'] as const).find((u) => u === q.get('unit')) ?? 'day';
  const full = q.get('full') === '1';
  const allEnv = q.get('env') === 'all';

  const board = await boardStats(dbTx() as never, 30); // the board chart always shows the last 30 days
  let visitors: unknown = null;
  let top: unknown = null;
  try {
    visitors = await siteVisitors(db(), range, unit, { full, allEnv });
    if (!full) {
      const { groups } = await insights(range, 5);
      const card = (g: string, t: string) =>
        groups.find((x) => x.title === g)?.cards.find((c) => c.title === t);
      top = [
        card('Listening', 'Embeds played'),
        card('The archive', 'Streams opened'),
        card('Talk with Aqua', 'Conversations started'),
        card('Health', 'Web vitals'),
      ].filter(Boolean);
    }
  } catch (e) {
    console.error('[stats]', e);
    visitors = { error: (e as Error).message };
  }
  return Response.json({ range, unit, configured: true, board, visitors, top });
};
