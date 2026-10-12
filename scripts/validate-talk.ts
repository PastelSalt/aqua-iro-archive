/**
 * Talk with Aqua validator (EXECUTIONPLAN §10.3). Runs in `npm run build`; exits 1 on any error.
 * Warnings are printed and the build continues.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { parse } from 'yaml';
import { parseScripts, validateScript } from '../src/lib/talk/schema.ts';
import { CHAPTERS } from '../src/lib/chapters.ts';

const DIR = 'src/content/talk';
const files = readdirSync(DIR)
  .filter((f) => f.endsWith('.yaml'))
  .map((name) => ({
    name,
    data: parse(readFileSync(`${DIR}/${name}`, 'utf8'), { uniqueKeys: true }) as unknown,
  }));
const watchlist = readFileSync('scripts/talk-watchlist.txt', 'utf8')
  .split('\n')
  .map((l) => l.trim())
  .filter((l) => l && !l.startsWith('#'));

const parsed = parseScripts(files);
const report = validateScript(parsed.conversations, parsed.idle, parsed.expressions, {
  watchlist,
  requireGotos: CHAPTERS.filter((c) => c.id !== 'home').map((c) => c.id),
});
const errors = [...parsed.errors, ...report.errors];

for (const w of report.warnings) console.warn(`  warn  ${w}`);
console.log(
  `validate-talk: ${report.stats.conversations} conversations (${Object.entries(report.stats)
    .filter(([k]) => k.startsWith('category:'))
    .map(([k, v]) => `${k.slice(9)} ${v}`)
    .join(
      ', ',
    )}) · ${report.stats.idle} idle · ${report.stats.rare} rare · ${report.warnings.length} warning(s)`,
);
console.log(
  `  contexts: ${Object.entries(report.stats)
    .filter(([k]) => k.startsWith('context:'))
    .map(([k, v]) => `${k.slice(8)} ${v}`)
    .join(' · ')}`,
);
if (process.argv.includes('--titles')) for (const t of report.titles) console.log(`  · ${t}`);
if (errors.length) {
  console.error(`\nvalidate-talk: ${errors.length} error(s)\n  ${errors.join('\n  ')}`);
  process.exit(1);
}
