/** GET /api/admin/insights?range=30d (docs/KEEPER-UPDATE-PLAN.md §6.3): every event card, labelled. Admin only. */
import type { APIRoute } from 'astro';
import { RANGE_DAYS } from '../../../server/analytics';
import { insights } from '../../../server/insights';

export const prerender = false;

export const GET: APIRoute = async ({ url, locals }) => {
  if (!locals.admin) return new Response('Unauthorized', { status: 401 });
  const range = (url.searchParams.get('range') ?? '') in RANGE_DAYS ? url.searchParams.get('range')! : '30d';
  try {
    return Response.json(
      { range, configured: true, ...(await insights(range, 25)) },
      { headers: { 'Cache-Control': 'private, max-age=300' } },
    );
  } catch (e) {
    return Response.json({ range, configured: true, error: (e as Error).message, groups: [], totals: {} });
  }
};
