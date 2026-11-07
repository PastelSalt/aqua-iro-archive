/**
 * Builds the local Keeper preview database (.keeper-preview/, git-ignored): an in-process Postgres (PGlite)
 * with the real migrations and seeds, plus made-up board activity so every Keeper screen has something to show.
 * Never touches Neon. Run: npx tsx scripts/dev/keeper-preview-db.mts, then npm run keeper:preview.
 */
import { readFileSync, readdirSync, rmSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';

const DIR = '.keeper-preview';
rmSync(DIR, { recursive: true, force: true });
const pg = new PGlite(DIR);
for (const f of readdirSync('db/migrations').filter((x) => x.endsWith('.sql')).sort())
  for (const stmt of readFileSync(`db/migrations/${f}`, 'utf8').split('--> statement-breakpoint'))
    if (stmt.trim()) await pg.exec(stmt);
for (const f of readdirSync('db/seed').filter((x) => x.endsWith('.sql')).sort())
  await pg.exec(readFileSync(`db/seed/${f}`, 'utf8'));

const LINES = [
  'こんあくあ！ずっと応援してるよ⚓',
  'Thank you for six years of fun streams, Aqua!',
  'あくたんのおかげで毎日がんばれた。ありがとう！',
  'The Minecraft series was my comfort stream every night.',
  'あくあ色パレット、今でも毎日聴いてます。',
  'Your 3D live made me cry happy tears.',
  'マリカのホロライブ杯、最高だった！',
  'I learned Japanese because of your streams.',
  'ずっと大好きだよ、あくたん。',
  'Gaming maid forever. Thank you, Aqua.',
];
const rand = (n: number) => Math.floor(Math.random() * n);
const ago = (days: number, hours = 0) => new Date(Date.now() - days * 86400_000 - hours * 3600_000).toISOString();
const ids: { id: string; status: string }[] = [];
for (let i = 0; i < 140; i++) {
  const status = i % 47 === 3 ? 'held' : i % 53 === 5 ? 'under_review' : i % 31 === 7 ? 'removed' : 'visible';
  const body = `${LINES[i % LINES.length]}${i % 3 ? '' : ' ✨'}`;
  const created = ago(rand(30), rand(24));
  const r = await pg.query<{ id: string }>(
    `INSERT INTO messages (body, body_hash, status, held_reason, report_count, removed_at, removed_reason, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
    [
      body,
      createHash('sha256').update(body + i).digest('hex'),
      status,
      status === 'held' ? (i % 2 ? 'newcomer' : 'term:1') : null,
      status === 'under_review' ? 3 : 0,
      status === 'removed' ? created : null,
      status === 'removed' ? 'Spam' : null,
      created,
    ],
  );
  ids.push({ id: r.rows[0]!.id, status });
}
const REASONS = ['spam', 'hate', 'off-topic', 'personal_info', 'other'];
for (const [n, m] of ids.filter((x) => x.status === 'under_review' || x.status === 'visible').slice(0, 6).entries())
  for (let k = 0; k < (m.status === 'under_review' ? 3 : 1); k++)
    await pg.query(
      `INSERT INTO reports (message_id, reason, note, reporter_hash, created_at) VALUES ($1, $2::report_reason, $3, $4, $5)`,
      [
        m.id,
        REASONS[(n + k) % REASONS.length] === 'off-topic' ? 'other' : REASONS[(n + k) % REASONS.length],
        k === 0 ? 'Looks like an ad link.' : null,
        `rep-${n}-${k}`,
        ago(rand(5), rand(24)),
      ],
    );
const ACTIONS: [string, Record<string, unknown>][] = [
  ['login', { country: 'PH', ipPrefix: '203.177' }],
  ['approve', { crewNo: 12 }],
  ['remove', { crewNo: 31, reason: 'Spam' }],
  ['settings_change', { key: 'report_threshold', from: 3, to: 4 }],
  ['term_add', { term: 'casino', kind: 'word', action: 'hold' }],
  ['login_failed', { country: 'US', ipPrefix: '45.12' }],
  ['bulk_approve', { crewNo: 40 }],
  ['restore', { crewNo: 31 }],
  ['pause', {}],
  ['resume', {}],
  ['twofa_reset', { by: 'script' }],
];
for (let i = 0; i < 60; i++) {
  const [action, detail] = ACTIONS[i % ACTIONS.length]!;
  await pg.query(
    `INSERT INTO admin_actions (actor_id, action, detail, created_at) VALUES ($1, $2::admin_action_kind, $3::jsonb, $4)`,
    [action.startsWith('login') || action === 'twofa_reset' ? null : 'preview-admin', action, JSON.stringify(detail), ago(i * 0.4)],
  );
}
const ERRORS = [
  ['/api/board/post', 'Turnstile verification timed out'],
  ['/api/board/list', 'Connection terminated unexpectedly'],
  ['/api/admin/stats', 'Connection terminated unexpectedly'],
];
for (let i = 0; i < 9; i++) {
  const [route, message] = ERRORS[i % ERRORS.length]!;
  await pg.query(`INSERT INTO app_errors (route, message, stack, at) VALUES ($1, $2, $3, $4)`, [
    route,
    message,
    `Error: ${message}\n    at handler (${route}.ts:42:11)\n    at process (router.mjs:82:11)`,
    ago(i * 0.7),
  ]);
}
await pg.query(
  `INSERT INTO settings (key, value) VALUES ('last_cron_at', $1::jsonb) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
  [JSON.stringify(ago(0, 5))],
);

// ---------------------------------------------------------------- sample visits (src/server/analytics.ts format)
// Real IDs from the site's data, so the Keeper's labels resolve to titles.
const streamIds = (JSON.parse(readFileSync('src/content/streams/streams.json', 'utf8')).streams as { id: string }[]).map((s) => s.id);
const clipIds = [...readFileSync('src/content/clips/clips.yaml', 'utf8').matchAll(/^- id: (\S+)/gm)].map((m) => m[1]!);
const artIds = [...readFileSync('src/content/arts/arts.yaml', 'utf8').matchAll(/^- id: (\S+)/gm)].map((m) => m[1]!);
const talkIds = readdirSync('src/content/talk')
  .filter((f) => f.endsWith('.yaml'))
  .flatMap((f) => [...readFileSync(`src/content/talk/${f}`, 'utf8').matchAll(/^- id: (\S+)/gm)].map((m) => m[1]!));
const PAGES = ['/', '/', '/', '/streaming', '/streaming', '/discography', '/messages', '/clips', '/arts', '/about', '/events'];
const UAS: [string, string, string, string][] = [
  ['mobile', 'Safari', 'iOS', 'Mozilla/5.0 (iPhone)'],
  ['mobile', 'Chrome', 'Android', 'Mozilla/5.0 (Linux; Android 14)'],
  ['desktop', 'Chrome', 'Windows', 'Mozilla/5.0 (Windows NT 10.0)'],
  ['desktop', 'Edge', 'Windows', 'Mozilla/5.0 (Windows NT 10.0) Edg/130'],
  ['tablet', 'Safari', 'iOS', 'Mozilla/5.0 (iPad)'],
];
const COUNTRIES = ['JP', 'JP', 'JP', 'JP', 'US', 'PH', 'ID', 'TW', 'KR'];
const REFS = ['x.com', 'youtube.com', 'google.com', null, null, null];
const pick = <T,>(xs: T[]) => xs[rand(xs.length)]!;
const vals: unknown[] = [];
const tuples: string[] = [];
const add = (at: Date, e: Record<string, unknown>) => {
  const cols = [at.toISOString(), e.event, e.path, e.visit, e.vh, e.device, e.browser, e.os, e.lang, e.country, e.ref ?? null, e.ms ?? null, e.props ? JSON.stringify(e.props) : null, 'production'];
  const start = vals.length;
  vals.push(...cols);
  tuples.push(`(${cols.map((_, i) => `$${start + i + 1}${i === 12 ? '::jsonb' : ''}`).join(', ')})`);
};
for (let d = 59; d >= 0; d--) {
  const perDay = 25 + rand(35) + (d < 7 ? 15 : 0);
  for (let v = 0; v < perDay; v++) {
    const [device, browser, os] = pick(UAS);
    const t0 = new Date(Date.now() - d * 86400_000 - rand(d === 0 ? 8 : 24) * 3600_000 - rand(3600_000));
    const base = { visit: `pv-${d}-${v}-${rand(1e6)}`, vh: `h-${d}-${v % 40}`, device, browser, os, lang: rand(10) < 7 ? 'ja' : 'en', country: pick(COUNTRIES) };
    const pages = 1 + rand(4);
    for (let i = 0; i < pages; i++) {
      const at = new Date(t0.getTime() + i * 60_000);
      const path = i === 0 ? pick(PAGES) : pick(PAGES);
      add(at, { ...base, event: 'page_view', path, ref: i === 0 ? pick(REFS) : null });
      add(new Date(at.getTime() + 50_000), { ...base, event: 'page_dwell', path, ms: 15_000 + rand(120_000) });
      if (path === '/streaming' && rand(2)) add(at, { ...base, event: 'stream_open', path, props: { id: pick(streamIds.slice(0, 80)) } });
      if (path === '/streaming' && !rand(3)) add(at, { ...base, event: 'stream_search', path, props: { q: pick(['マイクラ', 'minecraft', 'apex', '3D', 'karaoke']) } });
      if (path === '/clips' && rand(2)) add(at, { ...base, event: 'clip_open', path, props: { id: pick(clipIds) } });
      if (path === '/arts' && rand(2)) add(at, { ...base, event: 'art_open', path, props: { id: pick(artIds.slice(0, 40)) } });
      if (path === '/' && !rand(3)) {
        const conv = pick(talkIds.slice(0, 12));
        add(at, { ...base, event: 'talk_start', path, props: { conv } });
        if (rand(3)) add(at, { ...base, event: 'talk_end', path, props: { conv } });
      }
      if (rand(3)) add(at, { ...base, event: 'dock_nav', path, props: { to: pick(['streaming', 'discography', 'messages', 'clips', 'arts']), via: pick(['click', 'click', 'key']) } });
      if (i === 0 && !rand(4)) add(at, { ...base, event: 'cwv', path, props: { name: pick(['LCP', 'INP', 'CLS']), rating: pick(['good', 'good', 'good', 'needs-improvement', 'poor']) } });
      if (i === 0 && !rand(6)) add(at, { ...base, event: 'tour', path, props: { done: pick(['finish', 'finish', 'skip@dock']) } });
    }
    if (tuples.length > 400) {
      await pg.query(`INSERT INTO analytics_events (occurred_at, event, path, visit_id, visitor_hash, device, browser, os, language, country, referrer_host, duration_ms, props, environment) VALUES ${tuples.join(', ')}`, vals);
      vals.length = 0;
      tuples.length = 0;
    }
  }
}
if (tuples.length)
  await pg.query(`INSERT INTO analytics_events (occurred_at, event, path, visit_id, visitor_hash, device, browser, os, language, country, referrer_host, duration_ms, props, environment) VALUES ${tuples.join(', ')}`, vals);
await pg.close();
console.log(`✓ Keeper preview database ready in ${DIR}/ (140 notes, reports, 60 audit rows, 9 errors, 60 days of sample visits)`);
