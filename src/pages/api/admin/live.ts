/** GET /api/admin/live: visitors on the site in the last 5 minutes, for the Keeper's top bar. Admin only. */
import type { APIRoute } from 'astro';
import { activeNow } from '../../../server/umami';
import { keeperPreview } from '../../../server/dev/preview';

export const prerender = false;

export const GET: APIRoute = async ({ locals }) => {
  if (!locals.admin) return new Response('Unauthorized', { status: 401 });
  const active =
    import.meta.env.DEV && keeperPreview()
      ? (await import('../../../server/dev/fixtures')).previewActive()
      : await activeNow().catch(() => null);
  return Response.json({ active }, { headers: { 'Cache-Control': 'private, max-age=60' } });
};
