/**
 * ID → title for the Keeper (docs/KEEPER-UPDATE-PLAN.md §6.3): the analytics events carry YouTube IDs, stream
 * IDs, art IDs, Talk conversation IDs and chapter IDs; the Keeper shows what they are instead. Built once per
 * server instance from the same content the site is built from. Unknown IDs read "(removed item …)".
 */
import { getCollection } from 'astro:content';
import { parse } from 'yaml';
import { parseScripts } from '../lib/talk/schema';
import { CHAPTERS } from '../lib/chapters';
import streamsData from '../content/streams/streams.json';

type Labels = {
  video: Map<string, string>; // YouTube ID → song / clip / event / stream title
  stream: Map<string, { title: string; year: number }>;
  art: Map<string, string>;
  event: Map<string, string>;
  talk: Map<string, string>;
  talkChoice: Map<string, string>; // "conv/choice" → choice text
  chapter: Map<string, string>;
  counts: Record<'streams' | 'clips' | 'songs' | 'arts' | 'events' | 'talk', number>;
  newest: Partial<Record<'streams' | 'clips' | 'songs' | 'events', string>>;
};

const talkRaw = import.meta.glob<string>('/src/content/talk/*.yaml', {
  query: '?raw',
  import: 'default',
  eager: true,
});

let cache: Promise<Labels> | null = null;
export function labels(): Promise<Labels> {
  cache ??= build();
  return cache;
}

async function build(): Promise<Labels> {
  const [clips, events, arts, ...songLists] = await Promise.all([
    getCollection('clips'),
    getCollection('events'),
    getCollection('arts'),
    getCollection('originals'),
    getCollection('units'),
    getCollection('coversSolo'),
    getCollection('coversCollab'),
    getCollection('releases'),
  ]);
  const songs = songLists.flat();
  const video = new Map<string, string>();
  const stream = new Map<string, { title: string; year: number }>();
  for (const s of streamsData.streams as { id: string; title: string; year: number }[]) {
    stream.set(s.id, { title: s.title, year: s.year });
    video.set(s.id, s.title);
  }
  for (const e of events)
    if (e.data.youtube) video.set(e.data.youtube, e.data.title.en ?? e.data.title.ja ?? e.id);
  for (const c of clips) video.set(c.data.id, c.data.title);
  for (const s of songs)
    if (s.data.youtube)
      video.set(s.data.youtube, s.data.titleEn ? `${s.data.title} (${s.data.titleEn})` : s.data.title);

  const { conversations } = parseScripts(
    Object.entries(talkRaw).map(([path, text]) => ({
      name: path.split('/').pop()!,
      data: parse(text) as unknown,
    })),
  );
  const talk = new Map<string, string>();
  const talkChoice = new Map<string, string>();
  for (const c of conversations as unknown as {
    id: string;
    title: { en?: string; ja?: string };
    choices?: { id: string; en?: string; ja?: string }[];
  }[]) {
    talk.set(c.id, c.title.en ?? c.title.ja ?? c.id);
    for (const ch of c.choices ?? []) talkChoice.set(`${c.id}/${ch.id}`, ch.en ?? ch.ja ?? ch.id);
  }
  const latest = (xs: (string | undefined)[]) => xs.filter(Boolean).sort().at(-1);
  return {
    video,
    stream,
    art: new Map(arts.map((a) => [a.id, a.data.title.en ?? a.data.title.ja ?? a.id])),
    event: new Map(events.map((e) => [e.id, e.data.title.en ?? e.data.title.ja ?? e.id])),
    talk,
    talkChoice,
    chapter: new Map(CHAPTERS.map((c) => [c.id, `${c.no.replace('NO.', 'No.')} ${c.title.en}`])),
    counts: {
      streams: streamsData.summary.count,
      clips: clips.length,
      songs: songs.length,
      arts: arts.length,
      events: events.length,
      talk: conversations.length,
    },
    newest: {
      streams: latest((streamsData.streams as { date: string }[]).map((s) => s.date)),
      clips: latest(clips.map((c) => c.data.published)),
      songs: latest(songs.map((s) => s.data.date)),
      events: latest(events.map((e) => e.data.date)),
    },
  };
}

export const removed = (id: string) => `(removed item ${id.slice(0, 14)})`;
