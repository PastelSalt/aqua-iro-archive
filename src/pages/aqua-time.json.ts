/**
 * Aqua Time date index (IMPROVEMENT-PLAN Part 2 A). Everything dated in the archive, re-indexed by day:
 * streams, timeline events, songs, art and outfits. Built at compile time from the existing content —
 * nothing new is written here — and fetched only when the visitor opens Aqua Time or on the
 * once-a-session "on this day" check.
 */
import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import streamsFile from '../content/streams/streams.json';

type Row = { d: string; t: string; e?: string; u?: string };

export const GET: APIRoute = async () => {
  const streams = (streamsFile.streams as { id: string; date: string; title: string; durationSec: number }[])
    .map((s) => ({ d: s.date, t: s.title.slice(0, 70), u: s.id, s: s.durationSec }))
    .sort((a, b) => a.d.localeCompare(b.d));

  const events: Row[] = (await getCollection('events'))
    .map((e) => ({
      d: e.data.date,
      t: e.data.title.ja ?? e.data.title.en ?? '',
      e: e.data.title.en ?? '',
      k: e.data.type,
    }))
    .sort((a, b) => a.d.localeCompare(b.d));

  const songColls = ['originals', 'units', 'coversSolo', 'coversCollab', 'releases'] as const;
  const songs: Row[] = (
    await Promise.all(
      songColls.map(async (c) =>
        (await getCollection(c)).map((s) => ({
          d: s.data.date,
          t: s.data.title,
          e: s.data.titleEn ?? '',
          u: s.data.youtube ?? '',
          c,
        })),
      ),
    )
  )
    .flat()
    .filter((s) => /^\d{4}-\d{2}-\d{2}$/.test(s.d))
    .sort((a, b) => a.d.localeCompare(b.d));

  const arts: Row[] = (await getCollection('arts'))
    .filter((a) => a.data.date && /^\d{4}-\d{2}-\d{2}$/.test(a.data.date))
    .map((a) => ({
      d: a.data.date!,
      t: a.data.title.ja ?? a.data.title.en ?? '',
      e: a.data.title.en ?? '',
      u: a.id,
    }))
    .sort((a, b) => a.d.localeCompare(b.d));

  return new Response(
    JSON.stringify({ start: '2018-08-08', end: '2024-08-28', streams, events, songs, arts }),
    { headers: { 'Content-Type': 'application/json; charset=utf-8' } },
  );
};
