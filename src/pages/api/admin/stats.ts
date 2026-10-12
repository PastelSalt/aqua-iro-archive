/** GET /api/admin/stats?range= (EXECUTIONPLAN §12.2): chart data for /keeper, admin only (middleware), private cache. */
import type { APIRoute } from 'astro';
import { dbTx } from '../../../server/db/pool';
import { boardStats } from '../../../server/board/moderation';
import { overview, rangeFor, umamiConfigured, eventProperty } from '../../../server/umami';

export const prerender = false;

export const GET: APIRoute = async ({ url, locals }) => {
  if (!locals.admin) return new Response('Unauthorized', { status: 401 });
  const id = ['24h', '7d', '30d', '90d', 'all'].includes(url.searchParams.get('range') ?? '')
    ? url.searchParams.get('range')!
    : '7d';
  const days = { '24h': 1, '7d': 7, '30d': 30, '90d': 90, all: 365 }[id]!;
  const board = await boardStats(dbTx() as never, days);
  let visitors: unknown = null;
  let insights: Record<string, unknown> = {};
  if (umamiConfigured()) {
    const range = rangeFor(id);
    try {
      visitors = await overview(range);
      const pairs = [
        ['embeds', 'embed_play', 'id'],
        ['streams', 'stream_open', 'id'],
        ['searches', 'stream_search', 'q'],
        ['arts', 'art_open', 'id'],
        ['dock', 'dock_nav', 'to'],
        ['talkChoices', 'talk_choice', 'choice'],
        ['talkGoto', 'talk_goto', 'to'],
        ['cwvLcp', 'cwv', 'rating'],
      ] as const;
      insights = Object.fromEntries(
        await Promise.all(pairs.map(async ([k, e, p]) => [k, await eventProperty(range, e, p)] as const)),
      );
    } catch (e) {
      visitors = { error: (e as Error).message };
    }
  }
  return Response.json(
    { range: id, board, visitors, insights },
    { headers: { 'Cache-Control': 'private, max-age=300' } },
  );
};
