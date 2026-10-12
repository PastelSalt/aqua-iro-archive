/** GET /api/messages/count: visible total + next crew number preview, edge-cached 60 s. */
import type { APIRoute } from 'astro';
import { db } from '../../../server/db/http';
import { boardCounts } from '../../../server/board/list';
import { getSettings } from '../../../server/settings';

export const prerender = false;

export const GET: APIRoute = async () => {
  try {
    const [c, s] = await Promise.all([boardCounts(db()), getSettings(db())]);
    return new Response(JSON.stringify({ ...c, paused: s.posting_paused }), {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=0, s-maxage=60, stale-while-revalidate=300',
        'X-Robots-Tag': 'noindex',
      },
    });
  } catch {
    return new Response(JSON.stringify({ error: 'unavailable' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    });
  }
};
