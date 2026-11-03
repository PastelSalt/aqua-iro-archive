// Keeper preview: `astro dev` on :4322 with KEEPER_PREVIEW=1 (local PGlite with sample data, stand-in admin).
// Builds the preview database first if it is not there. Never touches Neon.
import { spawn, spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';

if (!existsSync('.keeper-preview'))
  spawnSync('npx', ['tsx', 'scripts/dev/keeper-preview-db.mts'], { stdio: 'inherit', shell: true });
spawn('npx', ['astro', 'dev', '--port', '4322'], {
  stdio: 'inherit',
  shell: true,
  env: { ...process.env, KEEPER_PREVIEW: '1' },
});
