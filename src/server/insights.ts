/**
 * Archive insights (docs/KEEPER-UPDATE-PLAN.md §6.3): the events the site already sends, grouped and labelled.
 * Each card is one (event, property) pair from the site's own analytics (src/server/analytics.ts), with IDs
 * turned into titles.
 */
import { eventCounts, eventProps, valuesOf, type RangeId } from './analytics';
import { db } from './db/http';
import { labels, removed } from './labels';

export type Row = { label: string; value: number; hint?: string };
export type Card = {
  title: string;
  icon: string;
  hint?: string;
  rows: Row[];
  tone?: 'pink' | 'navy' | 'teal';
};
export type Group = { title: string; cards: Card[] };

const pretty = (s: string) => s.replace(/[-_]/g, ' ').replace(/^\w/, (c) => c.toUpperCase());
const TOUR: Record<string, string> = { finish: 'Finished the tour' };
const NOTE_POST: Record<string, string> = { visible: 'Published', held: 'Held for review' };

export async function insights(
  rangeId: RangeId,
  limit = 10,
): Promise<{ groups: Group[]; totals: Record<string, number> }> {
  const L = await labels();
  const [counts, props] = await Promise.all([eventCounts(db(), rangeId), eventProps(db(), rangeId)]);
  const ev = Object.fromEntries(counts.map((r) => [r.x, r.y])) as Record<string, number>;
  const rows = async (event: string, prop: string, label: (v: string) => { label: string; hint?: string }) =>
    valuesOf(props, event, prop)
      .map((r) => ({ ...label(String(r.value)), value: Number(r.total) || 0 }))
      .sort((a, b) => b.value - a.value)
      .slice(0, limit);
  const video = (v: string) => ({ label: L.video.get(v) ?? removed(v) });
  const chapter = (v: string) => ({ label: L.chapter.get(v) ?? pretty(v) });
  const raw = (v: string) => ({ label: v || '(none)' });
  const choiceLabel = (v: string) => {
    for (const [k, text] of L.talkChoice) if (k.endsWith(`/${v}`)) return { label: text };
    return { label: pretty(v) };
  };

  const [embeds, songs, clips, streams, searches, years, arts, artSections, events, outfits, cards] =
    await Promise.all([
      rows('embed_play', 'id', video),
      rows('song_play', 'id', video),
      rows('clip_open', 'id', video),
      rows('stream_open', 'id', (v) => {
        const s = L.stream.get(v);
        return s ? { label: s.title, hint: String(s.year) } : { label: removed(v) };
      }),
      rows('stream_search', 'q', raw),
      rows('stream_filter', 'year', raw),
      rows('art_open', 'id', (v) => ({ label: L.art.get(v) ?? removed(v) })),
      rows('art_section', 'section', (v) => ({ label: pretty(v) })),
      rows('event_open', 'id', (v) => ({ label: L.event.get(v) ?? removed(v) })),
      rows('outfit_pick', 'outfit', (v) => ({ label: pretty(v) })),
      rows('chapter_card', 'to', chapter),
    ]);
  const [
    talkStart,
    talkEnd,
    choices,
    gotos,
    trips,
    tour,
    toggles,
    dock,
    dockVia,
    posts,
    reports,
    rating,
    names,
    notFound,
    outbound,
    discoTabs,
    bgm,
  ] = await Promise.all([
    rows('talk_start', 'conv', (v) => ({ label: L.talk.get(v) ?? pretty(v) })),
    rows('talk_end', 'conv', (v) => ({ label: L.talk.get(v) ?? pretty(v) })),
    rows('talk_choice', 'choice', choiceLabel),
    rows('talk_goto', 'to', chapter),
    rows('time_travel', 'to', (v) => ({ label: v === 'present' ? 'Back to the present' : v })),
    rows('tour', 'done', (v) => ({ label: TOUR[v] ?? `Skipped at "${v.replace('skip@', '')}"` })),
    rows('sys_toggle', 'what', (v) => ({ label: pretty(v === 'lang' ? 'language' : v) })),
    rows('dock_nav', 'to', chapter),
    rows('dock_nav', 'via', (v) => ({
      label: v === 'key' ? 'Number keys' : v === 'talk' ? 'From Talk' : 'Click',
    })),
    rows('note_post', 'status', (v) => ({
      label: NOTE_POST[v] ?? `Failed: ${v.replace('error:', '').toLowerCase().replace(/_/g, ' ')}`,
    })),
    rows('note_report', 'reason', (v) => ({ label: pretty(v) })),
    rows('cwv', 'rating', (v) => ({ label: pretty(v) })),
    rows('cwv', 'name', raw),
    rows('not_found', 'path', raw),
    rows('outbound', 'host', raw),
    rows('disco_tab', 'tab', (v) => ({ label: pretty(v) })),
    rows('bgm_play', 'id', (v) => ({ label: pretty(v) })),
  ]);

  // completion per conversation = finished ÷ started
  const ended = new Map(talkEnd.map((r) => [r.label, r.value]));
  const completion = talkStart.map((r) => ({
    label: r.label,
    value: r.value,
    hint: `${Math.round(((ended.get(r.label) ?? 0) / Math.max(1, r.value)) * 100)}% finished`,
  }));
  const groups: Group[] = [
    {
      title: 'Listening',
      cards: [
        {
          title: 'Embeds played',
          icon: 'play-circle',
          rows: embeds,
          hint: 'YouTube players opened on the site',
        },
        { title: 'Songs played (Discography)', icon: 'vinyl-record', rows: songs },
        { title: 'Background music', icon: 'music-notes', rows: bgm },
        { title: 'Discography tabs', icon: 'list', rows: discoTabs },
      ],
    },
    {
      title: 'The archive',
      cards: [
        { title: 'Streams opened', icon: 'broadcast', rows: streams },
        {
          title: 'Stream searches',
          icon: 'magnifying-glass',
          rows: searches,
          hint: 'What people typed (first 30 characters)',
        },
        { title: 'Year filters', icon: 'calendar-dots', rows: years },
        { title: 'Clips opened', icon: 'scissors', rows: clips },
        { title: 'Art opened', icon: 'palette', rows: arts },
        { title: 'Art sections', icon: 'palette', rows: artSections },
        { title: 'Events opened', icon: 'sailboat', rows: events },
        { title: 'Outfits picked (About)', icon: 'sparkle', rows: outfits },
        { title: 'Chapter cards clicked', icon: 'arrow-right', rows: cards },
      ],
    },
    {
      title: 'Talk with Aqua',
      cards: [
        {
          title: 'Conversations started',
          icon: 'chats-circle',
          rows: completion,
          tone: 'teal',
          hint: 'Started, with the share that reached the end',
        },
        { title: 'Top choices', icon: 'chat-circle-dots', rows: choices, tone: 'teal' },
        { title: '"Take me there" jumps', icon: 'arrow-square-out', rows: gotos, tone: 'teal' },
      ],
    },
    {
      title: 'Site features',
      cards: [
        { title: 'Aqua Time trips', icon: 'clock-countdown', rows: trips, tone: 'teal' },
        { title: 'First-visit tour', icon: 'flag', rows: tour, tone: 'teal' },
        { title: 'Dock: where people go', icon: 'house', rows: dock, tone: 'teal' },
        { title: 'Dock: how they get there', icon: 'cursor-click', rows: dockVia, tone: 'teal' },
        { title: 'Toggles used', icon: 'sliders-horizontal', rows: toggles, tone: 'teal' },
      ],
    },
    {
      title: 'Board',
      cards: [
        {
          title: 'Notes posted',
          icon: 'paper-plane-tilt',
          rows: posts,
          tone: 'navy',
          hint: 'Outcome of each attempt',
        },
        { title: 'Reports sent', icon: 'flag', rows: reports, tone: 'navy' },
      ],
    },
    {
      title: 'Health',
      cards: [
        {
          title: 'Web vitals',
          icon: 'pulse',
          rows: rating,
          tone: 'navy',
          hint: 'Every LCP / INP / CLS / FCP / TTFB measurement, by rating',
        },
        { title: 'Measurements by metric', icon: 'gauge', rows: names, tone: 'navy' },
        {
          title: 'Pages not found',
          icon: 'warning',
          rows: notFound,
          tone: 'navy',
          hint: '404 paths people hit',
        },
        { title: 'Outbound clicks', icon: 'link', rows: outbound, tone: 'navy' },
      ],
    },
  ];
  return {
    groups,
    totals: {
      talkStarted: ev.talk_start ?? 0,
      talkFinished: ev.talk_end ?? 0,
      tourShown: ev.tour ?? 0,
      embeds: (ev.embed_play ?? 0) + (ev.song_play ?? 0),
      searches: ev.stream_search ?? 0,
      undo: ev.note_undo ?? 0,
      help: ev.help_open ?? 0,
      log: ev.log_open ?? 0,
      album: ev.album_open ?? 0,
      talkHidden: ev.talk_hide ?? 0,
    },
  };
}
