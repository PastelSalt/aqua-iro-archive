// Static server for the built site with clean URLs and the vercel.json headers (incl. CSP), for e2e and previews.
// The on-demand routes (/api, /_actions, /keeper) are not served here — they need `vercel dev` or a deployment.
import { createServer } from 'node:http';
import { existsSync, readFileSync } from 'node:fs';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';

const base = new URL('../../', import.meta.url).pathname;
const root = existsSync(join(base, 'dist/client')) ? join(base, 'dist/client') : join(base, 'dist');
const vercel = JSON.parse(readFileSync(join(base, 'vercel.json'), 'utf8'));
const globalHeaders = Object.fromEntries(vercel.headers.find((h) => h.source === '/(.*)').headers.map((h) => [h.key, h.value]));
delete globalHeaders['Strict-Transport-Security'];
globalHeaders['Content-Security-Policy'] = globalHeaders['Content-Security-Policy'].replace('upgrade-insecure-requests', '');
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.avif': 'image/avif', '.woff2': 'font/woff2', '.xml': 'application/xml', '.txt': 'text/plain' };
const port = Number(process.argv[2] ?? 4322);
createServer(async (req, res) => {
  const p = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname)).replace(/^(\.\.[/\\])+/, '');
  for (const c of [p, p + '.html', join(p, 'index.html')]) {
    try {
      const f = join(root, c);
      if ((await stat(f)).isFile()) {
        res.writeHead(200, { ...globalHeaders, 'content-type': types[extname(f)] ?? 'application/octet-stream' });
        return res.end(await readFile(f));
      }
    } catch {}
  }
  res.writeHead(404, { ...globalHeaders, 'content-type': 'text/html; charset=utf-8' });
  res.end(await readFile(join(root, '404.html')).catch(() => 'not found'));
}).listen(port, () => console.log(`dist on http://localhost:${port}`));
