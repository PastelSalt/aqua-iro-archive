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
  ['/api/admin/stats', 'umami /stats 502'],
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
await pg.close();
console.log(`✓ Keeper preview database ready in ${DIR}/ (140 notes, reports, 60 audit rows, 9 errors)`);
