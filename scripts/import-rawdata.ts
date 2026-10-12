/**
 * One-time import: RAWDATA.md tables → src/content/**\/*.yaml (EXECUTIONPLAN §8.6).
 * After this runs once, the YAML files are the source of truth; edit them, not RAWDATA.md.
 *
 * Usage: tsx scripts/import-rawdata.ts [path/to/RAWDATA.md] [--force]
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { stringify } from 'yaml';

const args = process.argv.slice(2);
const force = args.includes('--force');
const src = resolve(args.find((a) => !a.startsWith('--')) ?? '../RAWDATA.md');
const OUT = resolve('src/content');
const HEADER = '# imported from RAWDATA.md 2026-10-11 — edit here from now on\n';

const md = readFileSync(src, 'utf8');

// ---------- markdown helpers ----------
type Section = { title: string; level: number; body: string[] };
const sections: Section[] = [];
for (const line of md.split('\n')) {
  const h = /^(#{2,4})\s+(.*)$/.exec(line);
  if (h) sections.push({ title: h[2]!.trim(), level: h[1]!.length, body: [] });
  else sections.at(-1)?.body.push(line);
}
function section(title: string): Section {
  const s = sections.find((x) => x.title === title || x.title.startsWith(title));
  if (!s) throw new Error(`Section not found: ${title}`);
  return s;
}
function splitRow(line: string): string[] {
  // split on | not escaped and not inside [..](..)
  const cells: string[] = [];
  let cur = '';
  let depth = 0;
  for (let i = 0; i < line.length; i++) {
    const c = line[i]!;
    if (c === '\\' && line[i + 1] === '|') {
      cur += '|';
      i++;
      continue;
    }
    if (c === '[' || c === '(') depth++;
    if ((c === ']' || c === ')') && depth > 0) depth--;
    if (c === '|' && depth === 0) {
      cells.push(cur.trim());
      cur = '';
      continue;
    }
    cur += c;
  }
  cells.push(cur.trim());
  return cells.slice(1, -1);
}
function table(s: Section): Record<string, string>[] {
  const lines = s.body.filter((l) => l.trim().startsWith('|'));
  if (lines.length < 2) return [];
  const head = splitRow(lines[0]!).map((h) => h.replace(/\*/g, ''));
  return lines.slice(2).map((l) => {
    const cells = splitRow(l);
    return Object.fromEntries(head.map((h, i) => [h, cells[i] ?? '']));
  });
}
function bullets(s: Section): string[] {
  return s.body.filter((l) => /^\s*-\s+/.test(l)).map((l) => l.replace(/^\s*-\s+/, '').trim());
}
const LINK = /\[([^\]]+)\]\(([^)]+)\)/;
function link(cell: string): { text: string; url?: string } {
  const m = LINK.exec(cell);
  return m ? { text: m[1]!, url: m[2]! } : { text: cell };
}
function unescape(s: string) {
  return s
    .replace(/\\([*_|~])/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .trim();
}
function ytId(url?: string): string | undefined {
  if (!url) return undefined;
  const m = /(?:watch\?v=|youtu\.be\/)([\w-]{11})/.exec(url);
  return m?.[1];
}
function views(cell: string): { n?: number; rest?: string } {
  const m = /^([\d.]+)\s*([MK])?/.exec(cell.trim());
  if (!m) return {};
  const n = Math.round(parseFloat(m[1]!) * (m[2] === 'M' ? 1e6 : m[2] === 'K' ? 1e3 : 1));
  const rest = cell
    .slice(m[0].length)
    .trim()
    .replace(/^\(|\)$/g, '');
  return { n, rest: rest || undefined };
}
function slug(s: string): string {
  return s
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}
const used = new Map<string, Set<string>>();
function uniq(ns: string, base: string): string {
  const set = used.get(ns) ?? new Set<string>();
  used.set(ns, set);
  let id = base || 'item';
  for (let i = 2; set.has(id); i++) id = `${base}-${i}`;
  set.add(id);
  return id;
}
/** split "日本語 (English)" into title + titleEn when the parenthetical is ASCII */
function splitTitle(t: string): { title: string; titleEn?: string } {
  const m = /^(.*?)\s*\(([\x20-\x7E]+)\)\s*$/.exec(t);
  if (m && /[^\x00-\x7F]/.test(m[1]!)) return { title: m[1]!.trim(), titleEn: m[2]!.trim() };
  return { title: t };
}
const out: Record<string, unknown[]> = {};
const unmapped: string[] = [];
function emit(file: string, rows: unknown[]) {
  out[file] = rows;
}

// ---------- About ----------
const PROFILE_JA: Record<string, string> = {
  Name: '名前',
  Nicknames: 'あだ名',
  'Branch / generation': '所属',
  Concept: 'コンセプト',
  Birthday: '誕生日',
  Height: '身長',
  Debut: '初配信',
  '3D debut': '3Dお披露目',
  'Graduation announced': '卒業発表',
  'Graduated / last stream': '卒業',
  Fanbase: 'ファンネーム',
  'Oshi mark': '推しマーク',
  Greeting: '挨拶',
  Pets: 'ペット',
  'Character designer': 'キャラクターデザイン',
  Live2D: 'Live2D',
  '3D': '3Dモデル',
  'Subscribers at graduation': '卒業時の登録者数',
  'Idol role model': '憧れのアイドル',
};
emit(
  'about/profile.yaml',
  table(section('Profile')).map((r, i) => {
    const field = r['Field']!;
    if (!PROFILE_JA[field]) unmapped.push(`profile: ${field}`);
    return {
      id: uniq('profile', slug(field)),
      order: i + 1,
      label: { ja: PROFILE_JA[field] ?? field, en: field },
      value: { en: unescape(r['Detail']!) },
    };
  }),
);
const LORE_STICKERS = ['heart', 'pad', 'onion', 'anchor', 'cat', 'note', 'heart'] as const;
emit(
  'about/lore.yaml',
  bullets(section('Personality and lore')).map((b, i) => ({
    id: `lore-${i + 1}`,
    text: { en: unescape(b) },
    sticker: LORE_STICKERS[i % LORE_STICKERS.length],
  })),
);
emit(
  'about/links.yaml',
  bullets(section('Official and fan links')).map((b) => {
    const label = b.split(':')[0]!.trim();
    const l = link(b);
    return {
      id: uniq('links', slug(label)),
      label,
      text: l.text,
      url: l.url,
      note:
        b.includes('(') && b.lastIndexOf('(') > b.indexOf(')')
          ? b.slice(b.lastIndexOf('(') + 1, -1)
          : undefined,
    };
  }),
);
emit(
  'about/relationships.yaml',
  table(section('Core relationships')).map((r) => {
    const name = r['Pairing']!;
    const members = r['Members']!.split(',').map((m) => m.trim());
    return {
      id: uniq('rel', slug(name.replace(/\(.*?\)|".*?"/g, ''))),
      name: { en: name },
      members,
      kind: members.length === 2 ? 'pair' : 'unit',
    };
  }),
);

// ---------- Clips ----------
emit(
  'clips/clips.yaml',
  table(section('Popular Clips')).map((r) => {
    const l = link(r['Clip']!);
    const id = ytId(l.url);
    if (!id) unmapped.push(`clip: ${r['Clip']}`);
    return {
      id,
      rank: Number(r['#']),
      title: unescape(l.text),
      clipper: r['Clipper'],
      views: views(r['Views']!).n,
      tags: [] as string[],
    };
  }),
);

// ---------- Songs ----------
function songRow(kind: string, r: Record<string, string>) {
  const titleCell = r['Title'] ?? r['Release']!;
  const l = link(titleCell);
  const { title, titleEn } = splitTitle(unescape(l.text));
  const youtube = ytId(l.url) ?? ytId(link(r['Link'] ?? '').url);
  const linkUrl = !youtube ? (l.url ?? link(r['Link'] ?? '').url) : undefined;
  const v = views(r['Views'] ?? '');
  const notes = [r['Notes'], v.rest].filter((x) => x && x !== '—').join(' · ');
  const withCell = r['With'] ?? r['As / with'];
  const base =
    slug(titleEn ?? title) || (youtube ? `${kind}-${youtube.toLowerCase()}` : `${kind}-${r['Date']}`);
  return {
    id: uniq('songs', base),
    date: r['Date']!,
    title,
    ...(titleEn ? { titleEn } : {}),
    kind,
    ...(r['Credits'] && r['Credits'] !== '—' ? { credits: unescape(r['Credits']) } : {}),
    ...(r['Original artist'] && r['Original artist'] !== '—'
      ? { credits: unescape(r['Original artist']) }
      : {}),
    ...(r['Type'] ? { credits: unescape(r['Type']) } : {}),
    with: withCell ? [unescape(withCell)] : [],
    ...(youtube ? { youtube } : {}),
    ...(linkUrl ? { link: linkUrl } : {}),
    ...(v.n ? { views: v.n } : {}),
    ...(notes ? { notes: { en: unescape(notes) } } : {}),
    highlight: youtube === '6bnaBnd4kyU',
  };
}
emit(
  'songs/originals.yaml',
  table(section('Originals — solo')).map((r) => songRow('original', r)),
);
emit(
  'songs/units.yaml',
  table(section('Originals — units')).map((r) => songRow('unit', r)),
);
emit(
  'songs/releases.yaml',
  table(section('Releases (EP / albums)')).map((r) => songRow('release', r)),
);
emit(
  'songs/covers-solo.yaml',
  table(section('Covers — solo')).map((r) => songRow('cover-solo', r)),
);
emit(
  'songs/covers-collab.yaml',
  table(section('Covers — collabs')).map((r) => songRow('cover-collab', r)),
);

// ---------- Streaming records ----------
emit(
  'streams/subscribers.yaml',
  table(section('Streaming Records')).map((r) => ({
    id: `subs-${r['Date']}`,
    date: r['Date'],
    count: Number(r['Subscribers']!.replace(/[^\d]/g, '')),
  })),
);
emit(
  'streams/records.yaml',
  table(section('Stream records')).map((r) => {
    const l = link(r['Stream']!);
    return {
      id: uniq('records', slug(r['Record']!)),
      label: { en: r['Record'] },
      ...(ytId(l.url) ? { youtube: ytId(l.url) } : {}),
      title: unescape(r['Stream']!.replace(LINK, '$1')),
      date: r['Date'],
      figure: { en: unescape(r['Figure']!) },
    };
  }),
);
emit(
  'streams/milestones.yaml',
  table(section('Milestone streams')).map((r) => {
    const l = link(r['Stream']!);
    const id = ytId(l.url);
    if (!id) unmapped.push(`milestone: ${r['Stream']}`);
    return { id, date: r['Date'], label: { en: r['Milestone'] }, title: l.text };
  }),
);
emit(
  'streams/year-totals.yaml',
  table(section('Stream archive at a glance'))
    .filter((r) => /^\d{4}$/.test(r['Year']!))
    .map((r) => ({
      id: r['Year'],
      streams: Number(r['Streams']),
      hours: Number(r['Hours']!.replace(/,/g, '')),
    })),
);

// ---------- Events ----------
const TYPE_MAP: Record<string, string> = {
  News: 'news',
  Milestone: 'milestone',
  Birthday: 'milestone',
  Lore: 'lore',
  Music: 'music',
  Collab: 'collab',
  Concert: 'live',
  Model: 'model',
  Unit: 'unit',
  Game: 'game',
  Award: 'award',
  Show: 'music',
  Graduation: 'graduation',
};
emit(
  'events/timeline.yaml',
  table(section('Career timeline')).map((r) => {
    const raw = r['Date']!;
    const date = /^\d{4}(-\d{2}(-\d{2})?)?/.exec(raw)?.[0] ?? raw;
    const type = TYPE_MAP[r['Type']!];
    if (!type) unmapped.push(`event type: ${r['Type']}`);
    const l = link(r['Event']!);
    const title = unescape(r['Event']!.replace(LINK, '$1'));
    return {
      id: uniq('events', `${date}-${slug(title).split('-').slice(0, 4).join('-')}`),
      date: date.length === 4 ? `${date}` : date,
      ...(raw !== date ? { dateLabel: raw } : {}),
      type: /announced/i.test(title) && type === 'news' && /graduation/i.test(title) ? 'announcement' : type,
      title: { en: title },
      ...(ytId(l.url) ? { youtube: ytId(l.url) } : l.url ? { url: l.url } : {}),
    };
  }),
);
emit(
  'events/brands.yaml',
  section('Brand and game collaborations')
    .body.join(' ')
    .trim()
    .replace(/\.$/, '')
    .split(/,\s*(?![^()]*\))/)
    .map((b) => unescape(b.trim()))
    .filter(Boolean)
    .map((name) => ({ id: uniq('brands', slug(name)), name })),
);

// ---------- write ----------
let total = 0;
for (const [file, rows] of Object.entries(out)) {
  const path = resolve(OUT, file);
  if (existsSync(path) && !force) {
    console.log(`skip  ${file} (exists; pass --force to overwrite)`);
    continue;
  }
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, HEADER + stringify(JSON.parse(JSON.stringify(rows)), { lineWidth: 0, version: '1.1' }));
  console.log(`wrote ${file.padEnd(28)} ${rows.length} rows`);
  total += rows.length;
}
console.log(`\n${total} rows written.`);
if (unmapped.length) {
  console.error(`\n${unmapped.length} unmapped:\n  ${unmapped.join('\n  ')}`);
  process.exit(1);
}
