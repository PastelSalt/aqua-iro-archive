/** Share images (EXECUTIONPLAN §21): 1200×630 per chapter — official art + title + credit line. */
import sharp from 'sharp';
import { mkdirSync } from 'node:fs';

const OUT = 'public/og';
mkdirSync(OUT, { recursive: true });
const PAGES: { id: string; no: string; ja: string; en: string; art: string; credit: string }[] = [
  {
    id: 'home',
    no: 'NO.00',
    ja: 'あくあ色アーカイブ',
    en: 'Aqua Iro Archive',
    art: 'src/assets/poses/full-08.webp',
    credit: 'Art © COVER Corp. — character design by Gaou',
  },
  {
    id: 'default',
    no: '⚓',
    ja: 'あくあ色アーカイブ',
    en: 'Aqua Iro Archive',
    art: 'src/assets/poses/full-01.webp',
    credit: 'Art © COVER Corp. — character design by Gaou',
  },
  {
    id: 'about',
    no: 'NO.01',
    ja: 'プロフィール',
    en: 'About',
    art: 'src/assets/poses/full-06.webp',
    credit: 'Art © COVER Corp. — character design by Gaou',
  },
  {
    id: 'clips',
    no: 'NO.02',
    ja: '切り抜き',
    en: 'Clips',
    art: 'src/assets/poses/full-07.webp',
    credit: 'Art © COVER Corp. — character design by Gaou',
  },
  {
    id: 'discography',
    no: 'NO.03',
    ja: 'ディスコグラフィ',
    en: 'Discography',
    art: 'src/assets/art/music/music-aqua-iro-palette.jpg',
    credit: '#あくあ色ぱれっと © COVER Corp.',
  },
  {
    id: 'streaming',
    no: 'NO.04',
    ja: '配信アーカイブ',
    en: 'Streaming',
    art: 'src/assets/poses/3d-heart.webp',
    credit: '3D model © COVER Corp. — ぽんぷ長',
  },
  {
    id: 'events',
    no: 'NO.05',
    ja: 'イベント',
    en: 'Events',
    art: 'src/assets/poses/full-08.webp',
    credit: 'Art © COVER Corp. — character design by Gaou',
  },
  {
    id: 'arts',
    no: 'NO.06',
    ja: 'アート',
    en: 'Arts',
    art: 'src/assets/art/designer/gaou-aquart-1.jpg',
    credit: 'AQUART cover © Gaou — character © COVER Corp.',
  },
  {
    id: 'messages',
    no: 'NO.07',
    ja: '寄せ書き',
    en: 'Message Board',
    art: 'src/assets/poses/full-01.webp',
    credit: 'Art © COVER Corp. — character design by Gaou',
  },
];
const esc = (s: string) => s.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]!);

for (const p of PAGES) {
  const isPose = p.art.includes('/poses/');
  const art = await sharp(p.art)
    .resize(isPose ? { height: 600 } : { width: 470, height: 470, fit: 'cover' })
    .png()
    .toBuffer();
  const meta = await sharp(art).metadata();
  const bg = Buffer.from(`<svg width="1200" height="630" xmlns="http://www.w3.org/2000/svg">
    <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FFF6FB"/><stop offset=".55" stop-color="#F4FBFF"/><stop offset="1" stop-color="#EAFBF8"/></linearGradient>
    <radialGradient id="c" cx=".5" cy=".42" r=".6"><stop offset="0" stop-color="#FFE9F5"/><stop offset=".5" stop-color="#E7DDF8"/><stop offset="1" stop-color="#C6EEF5"/></radialGradient>
    <linearGradient id="iro" x1="0" x2="1"><stop offset="0" stop-color="#F28CC4"/><stop offset=".45" stop-color="#C890E6"/><stop offset="1" stop-color="#6FCDEB"/></linearGradient></defs>
    <rect width="1200" height="630" fill="url(#g)"/>
    <circle cx="880" cy="315" r="250" fill="url(#c)" stroke="#fff" stroke-width="12"/>
    <circle cx="880" cy="315" r="278" fill="none" stroke="#CDB8EA" stroke-width="2" stroke-dasharray="6 8"/>
    <text x="72" y="170" font-family="Fredoka, 'Noto Sans CJK JP', sans-serif" font-size="22" font-weight="600" letter-spacing="7" fill="#9A4F8C">${esc(p.no)} — AQUA IRO ARCHIVE</text>
    <text x="68" y="270" font-family="Fredoka, 'Noto Sans CJK JP', sans-serif" font-size="${p.en.length > 12 ? 70 : 88}" font-weight="700" fill="#3B4583">${esc(p.en)}</text>
    <text x="72" y="340" font-family="'Noto Serif CJK JP', 'Noto Sans CJK JP', serif" font-size="40" font-weight="700" letter-spacing="8" fill="#9A4F8C">${esc(p.ja)}</text>
    <rect x="72" y="380" width="300" height="5" rx="2.5" fill="url(#iro)"/>
    <text x="72" y="440" font-family="'Noto Sans CJK JP', sans-serif" font-size="24" fill="#5E668F">湊あくあ 2018.08.08 → 2024.08.28</text>
    <text x="72" y="582" font-family="'Noto Sans CJK JP', sans-serif" font-size="17" fill="#5E668F">Unofficial non-profit fan archive · ${esc(p.credit)}</text>
  </svg>`);
  const left = Math.round(880 - (meta.width ?? 0) / 2);
  const top = isPose ? 630 - (meta.height ?? 0) : Math.round(315 - (meta.height ?? 0) / 2);
  const artFinal = isPose
    ? art
    : await sharp(art)
        .composite([
          {
            input: Buffer.from(`<svg width="470" height="470"><circle cx="235" cy="235" r="235"/></svg>`),
            blend: 'dest-in',
          },
        ])
        .png()
        .toBuffer();
  await sharp(bg)
    .composite([{ input: artFinal, left, top: Math.max(0, top) }])
    .jpeg({ quality: 82, mozjpeg: true })
    .toFile(`${OUT}/${p.id}.jpg`);
  console.log(`og/${p.id}.jpg`);
}
