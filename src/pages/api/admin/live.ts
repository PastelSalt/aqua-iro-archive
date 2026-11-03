/** GET /api/admin/live: visits with activity in the last 5 minutes, for the Keeper's top bar. Admin only. */
import type { APIRoute } from 'astro';
import { activeNow } from '../../../server/analytics';
import { dbTx } from '../../../server/db/pool';

export const prerender = false;

export const GET: APIRoute = async ({ locals }) => {
  if (!locals.admin) return new Response('Unauthorized', { status: 401 });
  const active = await activeNow(dbTx() as never).catch(() => null);
  return Response.json({ active }, { headers: { 'Cache-Control': 'private, max-age=60' } });
};
