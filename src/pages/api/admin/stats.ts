/**
 * GET /api/admin/stats?range=7d&unit=day[&full=1] (docs/KEEPER-UPDATE-PLAN.md §5): the dashboard's and the
 * Visitors page's data in one request — board series, Umami visitors (fixed periods, the chart series, the
 * breakdowns; `full` adds OS, language, screens, 25 rows and the 7 × 24 grid) and the dashboard's top-5
 * engagement lists. Admin only (middleware), private 5-minute cache.
 */
import type { APIRoute } from 'astro';
import { dbTx } from '../../../server/db/pool';
import { boardStats } from '../../../server/board/moderation';
import { RANGE_DAYS, umamiConfigured, visitors as umamiVisitors } from '../../../server/umami';
import { insights } from '../../../server/insights';
import { keeperPreview } from '../../../server/dev/preview';

export const prerender = false;
const DEV = import.meta.env.DEV && keeperPreview() ? await import('../../../server/dev/fixtures') : null;

export const GET: APIRoute = async ({ url, locals }) => {
  if (!locals.admin) return new Response('Unauthorized', { status: 401 });
  const q = url.searchParams;
  const range = (q.get('range') ?? '') in RANGE_DAYS ? q.get('range')! : '7d';
  const unit = (['day', 'week', 'month'] as const).find((u) => u === q.get('unit')) ?? 'day';
  const full = q.get('full') === '1';

  const board = await boardStats(dbTx() as never, 30); // the board chart always shows the last 30 days
  let visitors: unknown = null;
  let top: unknown = null;
  if (DEV || umamiConfigured()) {
    try {
      visitors = DEV ? await DEV.previewVisitors(range, unit, full) : await umamiVisitors(range, unit, full);
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
      visitors = { error: (e as Error).message };
    }
  }
  return Response.json(
    { range, unit, configured: !!(DEV || umamiConfigured()), board, visitors, top },
    { headers: { 'Cache-Control': 'private, max-age=300' } },
  );
};
