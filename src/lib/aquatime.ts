/**
 * Aqua Time (IMPROVEMENT-PLAN Part 2 A): the date the visitor has travelled to, shared by every page.
 * null = the present (the archive as it is). Stored per browser; changes fire `aia:time` on window and
 * set html[data-time] + html[data-season] so CSS can react. The index itself is /aqua-time.json.
 */
import { signal } from '@preact/signals';
import { read, write, remove } from './storage';

export const START = '2018-08-08';
export const END = '2024-08-28';
const KEY = 'aia:time';
export const DAYS = daysBetween(START, END); // 2,212

export type Row = { d: string; t: string; e?: string; u?: string; s?: number; k?: string; c?: string };
export type Index = { start: string; end: string; streams: Row[]; events: Row[]; songs: Row[]; arts: Row[] };

const isBrowser = typeof window !== 'undefined';
const valid = (d: unknown): d is string =>
  typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d) && d >= START && d <= END;
const stored = isBrowser ? read<string | null>(KEY, null) : null;
export const timeDate = signal<string | null>(valid(stored) ? stored : null);

export function daysBetween(a: string, b: string) {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 864e5);
}
export function addDays(d: string, n: number) {
  return new Date(Date.parse(`${d}T00:00:00Z`) + n * 864e5).toISOString().slice(0, 10);
}
export function season(d: string): 'spring' | 'summer' | 'autumn' | 'winter' {
  const m = Number(d.slice(5, 7));
  return m >= 3 && m <= 5 ? 'spring' : m >= 6 && m <= 8 ? 'summer' : m >= 9 && m <= 11 ? 'autumn' : 'winter';
}
export const dot = (d: string) => d.replace(/-/g, '.');

function reflect(d: string | null) {
  if (!isBrowser) return;
  const h = document.documentElement;
  if (d) {
    h.dataset.time = d;
    h.dataset.season = season(d);
  } else {
    delete h.dataset.time;
    delete h.dataset.season;
  }
}

export function setTime(d: string | null) {
  const v = d && valid(d) ? d : null;
  timeDate.value = v;
  if (v) write(KEY, v);
  else remove(KEY);
  reflect(v);
  window.dispatchEvent(new CustomEvent('aia:time', { detail: v }));
}

let cache: Promise<Index> | null = null;
export function loadIndex(): Promise<Index> {
  cache ??= fetch('/aqua-time.json').then((r) => {
    if (!r.ok) throw new Error(`aqua-time.json ${r.status}`);
    return r.json() as Promise<Index>;
  });
  cache.catch(() => (cache = null));
  return cache;
}

/** rows on or before d (sorted ascending input) */
export const upTo = (rows: Row[], d: string) => {
  let lo = 0;
  let hi = rows.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (rows[mid]!.d <= d) lo = mid + 1;
    else hi = mid;
  }
  return lo; // count
};
export const between = (rows: Row[], from: string, to: string) =>
  rows.filter((r) => r.d >= from && r.d <= to);

/** A fan-written greeting about the chosen day (labelled as fan-written in the panel). */
export function greeting(ix: Index, d: string, ja: boolean) {
  const evs = between(ix.events, addDays(d, -3), addDays(d, 3));
  const exact = evs.find((e) => e.d === d) ?? evs[0];
  const md = d.slice(5);
  if (md === '08-08')
    return ja
      ? `今日はデビュー記念日！${Number(d.slice(0, 4)) - 2018}周年だよ〜 ⚓`
      : `It's my debut anniversary — ${Number(d.slice(0, 4)) - 2018} years! ⚓`;
  if (md === '12-01')
    return ja
      ? '今日はあてぃしの誕生日！お祝いありがと〜！！'
      : "It's my birthday today! Thank you for celebrating~!";
  if (exact)
    return ja
      ? `この日は「${exact.t}」の${exact.d === d ? '日' : 'ころ'}だよ！`
      : `This is ${exact.d === d ? 'the day of' : 'around'} "${exact.e || exact.t}"!`;
  const st = between(ix.streams, d, d)[0];
  if (st)
    return ja ? `今日の配信は「${st.t}」！見に来てくれる？` : `Today's stream: "${st.t}". Coming to watch?`;
  return ja
    ? 'この日は配信お休み……たぶんずっとゲームしてた！'
    : 'No stream this day… I was probably gaming all day anyway!';
}

/** What happened on this month/day in past years (2018–2024), newest first. */
export function onThisDay(ix: Index, md: string) {
  const all = [
    ...ix.events.map((r) => ({ ...r, kind: 'event' as const })),
    ...ix.songs.map((r) => ({ ...r, kind: 'song' as const })),
    ...ix.streams.map((r) => ({ ...r, kind: 'stream' as const })),
    ...ix.arts.map((r) => ({ ...r, kind: 'art' as const })),
  ];
  const order = { event: 0, song: 1, art: 2, stream: 3 };
  return all
    .filter((r) => r.d.slice(5) === md)
    .sort((a, b) => b.d.localeCompare(a.d) || order[a.kind] - order[b.kind]);
}

if (isBrowser) {
  reflect(timeDate.value);
  // ClientRouter copies <html> attributes from the next page, which drops data-time: put it back
  document.addEventListener('astro:after-swap', () => reflect(timeDate.value));
}
