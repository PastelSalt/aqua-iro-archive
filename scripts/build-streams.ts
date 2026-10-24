/**
 * streams.full.tsv + overrides → src/content/streams/streams.json (EXECUTIONPLAN §8.3)
 * and public/data/stream-search.json (prebuilt Fuse index, loaded on first search focus).
 * Fails the build if any assertion in §8.3 does not hold.
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { parse } from 'yaml';
import Fuse from 'fuse.js';
import { z } from 'astro/zod';
import { autoTags, STREAM_TAGS, type StreamTag } from '../src/lib/streams/tags.ts';
import { searchForm } from '../src/lib/text/kana.ts';

const SNAPSHOT = '2026-10-11';
const EXPECT = {
  count: 639,
  hours: 2013,
  years: { 2018: 1, 2019: 31, 2020: 197, 2021: 135, 2022: 60, 2023: 77, 2024: 138 },
};

const readYaml = <T>(p: string, fallback: T): T =>
  existsSync(p) ? ((parse(readFileSync(p, 'utf8')) as T) ?? fallback) : fallback;

const Row = z.object({
  id: z.string().regex(/^[\w-]{11}$/),
  ymd: z.string().regex(/^\d{8}$/),
  seconds: z.coerce.number().int().nonnegative(),
  views: z.coerce.number().int().nonnegative(),
  title: z.string().min(1),
});

const games = readYaml<string[]>('data/overrides/games.yaml', []).map((g) =>
  g.normalize('NFKC').toLowerCase(),
);
const categoryOverrides = readYaml<Record<string, StreamTag[]>>('data/overrides/stream-categories.yaml', {});
const highlights = readYaml<Record<string, { note?: string }>>('data/overrides/stream-highlights.yaml', {});
const milestones = readYaml<{ id: string; date: string; label: { en: string; ja?: string } }[]>(
  'src/content/streams/milestones.yaml',
  [],
);
const records = readYaml<{ id: string; youtube?: string; label: { en: string; ja?: string } }[]>(
  'src/content/streams/records.yaml',
  [],
);
const milestoneById = new Map(milestones.map((m) => [m.id, m]));
const recordById = new Map(records.filter((r) => r.youtube).map((r) => [r.youtube!, r]));

const errors: string[] = [];
// \r?\n: a Windows checkout has CRLF line endings, which would otherwise leave '\r' on every title
const lines = readFileSync('data/raw/streams.full.tsv', 'utf8').split(/\r?\n/).filter(Boolean);
let dropped = 0;

export type Stream = {
  id: string;
  date: string;
  year: number;
  title: string;
  durationSec: number;
  views: number;
  tags: StreamTag[];
  milestone?: { en: string; ja?: string };
  record?: { en: string; ja?: string };
  url: string;
};

const streams: Stream[] = [];
for (const line of lines) {
  const [id, ymd, seconds, views, , ...titleParts] = line.split('\t');
  const parsed = Row.safeParse({ id, ymd, seconds, views, title: titleParts.join('\t') });
  if (!parsed.success) {
    dropped++;
    errors.push(
      `invalid row: ${line.slice(0, 80)} → ${parsed.error.issues.map((i) => i.message).join(', ')}`,
    );
    continue;
  }
  const r = parsed.data;
  const ms = milestoneById.get(r.id);
  const date = ms?.date ?? `${r.ymd.slice(0, 4)}-${r.ymd.slice(4, 6)}-${r.ymd.slice(6, 8)}`;
  let tags = categoryOverrides[r.id] ?? autoTags(r.title, date, games);
  if (ms && !tags.includes('milestone')) tags = [...tags, 'milestone'];
  if (highlights[r.id] && !tags.includes('special')) tags = [...tags, 'special'];
  for (const t of tags) if (!STREAM_TAGS.includes(t)) errors.push(`unknown tag ${t} on ${r.id}`);
  streams.push({
    id: r.id,
    date,
    year: Number(date.slice(0, 4)),
    title: r.title,
    durationSec: r.seconds,
    views: r.views,
    tags: STREAM_TAGS.filter((t) => tags.includes(t)),
    ...(ms ? { milestone: ms.label } : {}),
    ...(recordById.get(r.id) ? { record: recordById.get(r.id)!.label } : {}),
    url: `https://www.youtube.com/watch?v=${r.id}`,
  });
}
streams.sort((a, b) => (a.date === b.date ? 0 : a.date < b.date ? 1 : -1));

// ---------- summary ----------
const byYear = new Map<number, { year: number; count: number; seconds: number; views: number }>();
const byTag = Object.fromEntries(STREAM_TAGS.map((t) => [t, 0])) as Record<StreamTag, number>;
const byMonth = new Map<string, number>();
for (const s of streams) {
  const y = byYear.get(s.year) ?? { year: s.year, count: 0, seconds: 0, views: 0 };
  y.count++;
  y.seconds += s.durationSec;
  y.views += s.views;
  byYear.set(s.year, y);
  for (const t of s.tags) byTag[t]++;
  byMonth.set(s.date.slice(0, 7), (byMonth.get(s.date.slice(0, 7)) ?? 0) + 1);
}
const totalSeconds = streams.reduce((a, s) => a + s.durationSec, 0);
const years = [...byYear.values()]
  .sort((a, b) => a.year - b.year)
  .map((y) => ({ ...y, hours: Math.round(y.seconds / 3600) }));
const summary = {
  count: streams.length,
  hours: Math.round(totalSeconds / 3600),
  views: streams.reduce((a, s) => a + s.views, 0),
  years,
  tags: byTag,
  busiestMonth: [...byMonth.entries()].sort((a, b) => b[1] - a[1])[0],
  longest: [...streams].sort((a, b) => b.durationSec - a.durationSec)[0]!.id,
  mostViewed: [...streams].sort((a, b) => b.views - a.views)[0]!.id,
};

// ---------- assertions (§8.3) ----------
if (dropped > 0) errors.push(`${dropped} rows dropped`);
if (streams.length !== EXPECT.count) errors.push(`expected ${EXPECT.count} streams, got ${streams.length}`);
for (const [y, n] of Object.entries(EXPECT.years)) {
  const got = byYear.get(Number(y))?.count ?? 0;
  if (got !== n) errors.push(`year ${y}: expected ${n} streams, got ${got}`);
}
if (Math.abs(summary.hours - EXPECT.hours) > 1)
  errors.push(`expected ${EXPECT.hours} ± 1 h, got ${summary.hours}`);
const ids = new Set(streams.map((s) => s.id));
if (ids.size !== streams.length) errors.push('duplicate stream ids');
for (const m of milestones) if (!ids.has(m.id)) errors.push(`milestone ${m.id} (${m.label.en}) not in TSV`);
for (const id of Object.keys(categoryOverrides))
  if (!ids.has(id)) errors.push(`override for unknown stream ${id}`);

if (errors.length) {
  console.error(`build-streams: ${errors.length} problem(s)\n  ${errors.join('\n  ')}`);
  process.exit(1);
}

// ---------- write ----------
mkdirSync('src/content/streams', { recursive: true });
writeFileSync(
  'src/content/streams/streams.json',
  JSON.stringify({ snapshotDate: SNAPSHOT, summary, streams }) + '\n',
);

const docs = streams.map((s) => ({ id: s.id, t: searchForm(s.title) }));
const index = Fuse.createIndex(['t'], docs);
mkdirSync('public/data', { recursive: true });
writeFileSync('public/data/stream-search.json', JSON.stringify({ docs, index: index.toJSON() }));

const untagged = streams.filter((s) => s.tags.length === 0).length;
console.log(
  `build-streams: ${streams.length} streams · ${summary.hours} h · ${(summary.views / 1e6).toFixed(1)}M views · ` +
    `${untagged} untagged · tags ${Object.entries(byTag)
      .map(([k, v]) => `${k}:${v}`)
      .join(' ')}`,
);
