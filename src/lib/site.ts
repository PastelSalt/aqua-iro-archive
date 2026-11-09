/** Site-wide constants. */
export const SITE_NAME = 'Aqua Iro Archive';
/** Removal / correction contact (§9.8): the Moeko Works contact form (it has a message form). */
export const CONTACT_URL = 'https://moekoworks.vercel.app/contact';
/** The maker's portfolio — credited in the splash, footer and HELP panel. */
export const PORTFOLIO = { name: 'Moeko Works', url: 'https://moekoworks.vercel.app' };
/** Footer banner cards (VISUAL-REFINEMENT-PLAN §7g); mark and tint come from each site's own title and theme-color. */
export const SISTER_SITES = [
  {
    name: 'Kotoha',
    url: 'https://kotoha-fansite.vercel.app',
    mark: '🍀',
    tint: '#fe9fb9',
    note: { ja: 'ことは ファンサイト', en: 'Kotoha fan site' },
  },
  {
    name: 'Hanon',
    url: 'https://hanon-fansite.vercel.app',
    mark: '🐧',
    tint: '#b7d7ef',
    note: { ja: 'はのん ファンサイト', en: 'Hanon fan site' },
  },
];
export const OFFICIAL = {
  youtube: 'https://www.youtube.com/channel/UC1opHUrw8rvnsadT-iGp7Cg',
  x: 'https://x.com/minatoaqua',
};
export const COVER_GUIDELINES = 'https://hololivepro.com/en/terms/';

/**
 * Search identity. The maker's Person @id is the one the Moeko Works portfolio publishes in its own JSON-LD,
 * so search engines join both sites to one creator. Keep them in step if the portfolio changes.
 */
export const AUTHOR = {
  id: 'https://moekoworks.vercel.app/#person',
  name: 'Kyle Zoleta',
  brand: PORTFOLIO.name,
  url: PORTFOLIO.url,
  sameAs: ['https://github.com/PastelSalt', 'https://web.facebook.com/moemorimoeko/'],
};
/** The archive's subject, linked to her public reference pages (Wikidata, Wikipedia, official channels). */
export const SUBJECT = {
  name: 'Minato Aqua',
  alternateName: ['湊あくあ', 'みなとあくあ', 'あくたん', 'Aqua', 'Akutan'],
  description: 'Japanese virtual YouTuber, a member of hololive 2nd Generation (2018–2024).',
  sameAs: [
    'https://www.wikidata.org/wiki/Q88874152',
    'https://en.wikipedia.org/wiki/Minato_Aqua',
    'https://ja.wikipedia.org/wiki/%E6%B9%8A%E3%81%82%E3%81%8F%E3%81%82',
    'https://hololive.hololivepro.com/en/talents/minato-aqua/',
    OFFICIAL.youtube,
    OFFICIAL.x,
  ],
};
/** Terms people search the archive by; used for meta keywords and the WebSite node. */
export const KEYWORDS = [
  '湊あくあ',
  'Minato Aqua',
  'あくたん',
  'ホロライブ',
  'hololive',
  'ホロライブ2期生',
  'VTuber',
  '湊あくあ 卒業',
  '湊あくあ 切り抜き',
  '湊あくあ 歌',
  'Minato Aqua archive',
  'Minato Aqua graduation',
  'Aqua Iro Archive',
  'あくあ色アーカイブ',
  'Kyle Zoleta',
  'Moeko Works',
];
