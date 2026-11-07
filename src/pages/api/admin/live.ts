/** GET /api/admin/live: visits that sent anything in the last 5 minutes, for the Keeper's top bar. Admin only. */
import type { APIRoute } from 'astro';
import { activeNow } from '../../../server/analytics';
import { db } from '../../../server/db/http';

export const prerender = false;

export const GET: APIRoute = async ({ locals }) => {
  if (!locals.admin) return new Response('Unauthorized', { status: 401 });
  const active = await activeNow(db()).catch(() => null);
  return Response.json({ active });
};
