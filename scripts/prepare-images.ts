/**
 * Curate Project 44.5/assets → src/assets (EXECUTIONPLAN §8.7).
 * Only files referenced by src/content/arts/arts.yaml, the POSES list and the LOGOS list are copied.
 * Resizes to a long edge of MAX_EDGE, strips metadata, keeps transparency (as near-lossless WebP with alpha; logos stay PNG),
 * everything else → JPEG. Astro re-encodes all of them to AVIF/WebP at build, so these are high-quality sources.
 * Writes `image`, `credit` and `source` back into arts.yaml (comments preserved). Fails above BUDGET_MB.
 *
 * Usage: tsx scripts/prepare-images.ts [--assets ../assets] [--force]
 */
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync, readdirSync } from 'node:fs';
import { join, resolve, extname } from 'node:path';
import sharp from 'sharp';
import { parseDocument, YAMLMap } from 'yaml';

const argv = process.argv.slice(2);
const ASSETS = resolve(
  argv[argv.indexOf('--assets') + 1] && argv.includes('--assets')
    ? argv[argv.indexOf('--assets') + 1]!
    : '../assets',
);
const FORCE = argv.includes('--force');
const ARTS = 'src/content/arts/arts.yaml';
const OUT = 'src/assets';
const MAX_EDGE = 2000; // §8.7 says 2400; 2000 keeps ~185 images inside the 60 MB budget (lightbox widths cap at 2000)
const POSE_MAX_H = 1600; // hero renders ≈ 770 px tall → 2× density
const BUDGET_MB = 60;

/** Hero / expression poses → src/assets/poses/<id>.png */
const POSES: Record<string, string> = {
  'full-01': '01-priority/poses-2d/Minato_Aqua_-_Full_Illustration_01.png',
  'full-06': '01-priority/poses-2d/Minato_Aqua_-_Full_Illustration_06-2.png',
  'full-07': '01-priority/poses-2d/Minato_Aqua_-_Full_Illustration_07.png',
  'full-08': '01-priority/poses-2d/Minato_Aqua_-_Full_Illustration_08.png',
  'portrait-01': '01-priority/poses-2d/Minato_Aqua_-_Portrait_01.png',
  'portrait-03': '01-priority/poses-2d/Minato_Aqua_-_Portrait_03.png',
  'portrait-04': '01-priority/poses-2d/Minato_Aqua_-_Portrait_04.png',
  'portrait-06': '01-priority/poses-2d/Minato_Aqua_-_Portrait_06.png',
  'main-icon': '01-priority/poses-2d/Minato_Aqua_-_Main_Page_Icon.png',
  'portrait-wiki': '01-priority/poses-2d/Minato_Aqua_Portrait.png',
  '3d-peace': '01-priority/poses-3d/Minato_Aqua_-_Portrait_3D_01-2.png',
  '3d-live-wink': '01-priority/poses-3d/Minato_Aqua_-_Portrait_3D_05.png',
  'mmd-smile': '01-priority/poses-3d/Minato_Aqua_-_Portrait_MMD_01.png',
  '3d-heart': '01-priority/poses-3d/Minato_Aqua_-_3D_Model_01-2.png',
};
/** Site chrome logos → src/assets/logo/<id>.png */
const LOGOS: Record<string, string> = {
  channel: '01-priority/logo/Channel_Logo_-_Minato_Aqua_01.png',
  signature: '01-priority/logo/Minato_Aqua_-_Signature.png',
  'aqua-iro-super-dream': '01-priority/logo/Logo_-_AQUA_IRO_SUPER_DREAM.png',
  umisea: '01-priority/logo/Logo_-_UMISEA.png',
  startend: '01-priority/logo/Logo_-_StartEnd_Clear_Background.png',
};

type ManifestRow = [
  folder: string,
  file: string,
  caption: string,
  credit: string,
  source: string,
  bytes: number,
];
const manifest = JSON.parse(readFileSync('data/raw/manifest.json', 'utf8')) as ManifestRow[];
const byPath = new Map(manifest.map((r) => [`${r[0]}/${r[1]}`, r]));

async function hasRealAlpha(path: string): Promise<boolean> {
  const img = sharp(path, { animated: false });
  const meta = await img.metadata();
  if (!meta.hasAlpha) return false;
  const stats = await img.stats();
  return !stats.isOpaque;
}

async function convert(
  src: string,
  destNoExt: string,
  opts: { maxEdge?: number; maxH?: number; alpha?: boolean; png?: boolean },
) {
  const alpha = opts.alpha || opts.png || (await hasRealAlpha(src));
  const ext = opts.png ? '.png' : alpha ? '.webp' : '.jpg';
  const dest = destNoExt + ext;
  if (existsSync(dest) && !FORCE && statSync(dest).mtimeMs > statSync(src).mtimeMs) return dest;
  let p = sharp(src, { animated: false }).rotate(); // apply EXIF orientation, then metadata is dropped by default
  p = opts.maxH
    ? p.resize({ height: opts.maxH, withoutEnlargement: true })
    : p.resize({ width: opts.maxEdge, height: opts.maxEdge, fit: 'inside', withoutEnlargement: true });
  p = opts.png
    ? p.png({ compressionLevel: 9 })
    : alpha
      ? p.webp({ quality: 92, alphaQuality: 100, effort: 6 })
      : p.flatten({ background: '#ffffff' }).jpeg({ quality: 84, mozjpeg: true });
  await p.toFile(dest);
  return dest;
}

function dirSize(dir: string): number {
  if (!existsSync(dir)) return 0;
  return readdirSync(dir, { withFileTypes: true }).reduce(
    (a, d) => a + (d.isDirectory() ? dirSize(join(dir, d.name)) : statSync(join(dir, d.name)).size),
    0,
  );
}

const problems: string[] = [];

// ---------- arts ----------
const doc = parseDocument(readFileSync(ARTS, 'utf8'));
const items = (doc.contents as unknown as { items: YAMLMap[] }).items;
for (const item of items) {
  const id = String(item.get('id'));
  const file = String(item.get('file'));
  const section = String(item.get('section'));
  const row = byPath.get(file);
  if (!row) {
    problems.push(`arts ${id}: ${file} is not in manifest.json`);
    continue;
  }
  const src = join(ASSETS, file);
  if (!existsSync(src)) {
    problems.push(`arts ${id}: missing source ${src}`);
    continue;
  }
  mkdirSync(join(OUT, 'art', section), { recursive: true });
  const dest = await convert(src, join(OUT, 'art', section, id), { maxEdge: MAX_EDGE });
  item.set('image', `../../assets/art/${section}/${id}${extname(dest)}`);
  item.set('credit', row[3]);
  item.set('source', row[4]);
  process.stdout.write('.');
}
writeFileSync(ARTS, doc.toString({ lineWidth: 0 }));
console.log(`\narts: ${items.length} entries`);

// ---------- poses + logos ----------
mkdirSync(join(OUT, 'poses'), { recursive: true });
mkdirSync(join(OUT, 'logo'), { recursive: true });
for (const [id, file] of Object.entries(POSES))
  await convert(join(ASSETS, file), join(OUT, 'poses', id), { maxH: POSE_MAX_H, alpha: true });
for (const [id, file] of Object.entries(LOGOS))
  await convert(join(ASSETS, file), join(OUT, 'logo', id), { maxEdge: 1200, png: true });
console.log(`poses: ${Object.keys(POSES).length} · logos: ${Object.keys(LOGOS).length}`);

// ---------- budget ----------
const mb = dirSize(OUT) / 1024 / 1024;
console.log(`src/assets: ${mb.toFixed(1)} MB (budget ${BUDGET_MB} MB)`);
if (mb > BUDGET_MB) problems.push(`src/assets is ${mb.toFixed(1)} MB, over the ${BUDGET_MB} MB budget`);
if (problems.length) {
  console.error(problems.join('\n'));
  process.exit(1);
}
