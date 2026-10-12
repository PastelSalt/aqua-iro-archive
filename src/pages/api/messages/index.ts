/** GET /api/messages (EXECUTIONPLAN §12.3): edge-cached list. Never reads cookies, never returns hashes or held notes. */
import type { APIRoute } from 'astro';
import { db } from '../../../server/db/http';
import { listNotes, boardCounts } from '../../../server/board/list';
import { logError } from '../../../server/log';

export const prerender = false;

export const GET: APIRoute = async ({ url }) => {
  const sort = url.searchParams.get('sort') === 'random' ? 'random' : 'new';
  const cursorRaw = url.searchParams.get('cursor');
  const cursor = cursorRaw && /^\d{1,9}$/.test(cursorRaw) ? Number(cursorRaw) : null;
  const seed = Math.min(50, Math.max(1, Number(url.searchParams.get('seed')) || 1));
  const limit = Math.min(60, Math.max(1, Number(url.searchParams.get('limit')) || 30));
  try {
    const [page, counts] = await Promise.all([
      listNotes(db(), { sort, cursor, seed, limit }),
      boardCounts(db()),
    ]);
    return new Response(JSON.stringify({ ...page, ...counts }), {
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'public, max-age=0, s-maxage=10, stale-while-revalidate=60',
        'X-Robots-Tag': 'noindex',
      },
    });
  } catch (e) {
    await logError(null, 'api/messages', e);
    return new Response(JSON.stringify({ error: 'unavailable' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    });
  }
};
