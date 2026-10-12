/** The 8 chapters, fixed order (EXECUTIONPLAN §7.3). */
export type ChapterId =
  'home' | 'about' | 'clips' | 'discography' | 'streaming' | 'events' | 'arts' | 'messages';

export type Chapter = {
  id: ChapterId;
  no: string; // "NO.03"
  ja: string; // dock label
  en: string; // dock sub-label
  title: { ja: string; en: string }; // full chapter title
  href: string;
  tint: string; // CSS var name
};

export const CHAPTERS: Chapter[] = [
  {
    id: 'home',
    no: 'NO.00',
    ja: 'ホーム',
    en: 'HOME',
    title: { ja: 'ホーム', en: 'Home' },
    href: '/',
    tint: '--tint-home',
  },
  {
    id: 'about',
    no: 'NO.01',
    ja: 'プロフィール',
    en: 'ABOUT',
    title: { ja: 'プロフィール', en: 'About' },
    href: '/about',
    tint: '--tint-about',
  },
  {
    id: 'clips',
    no: 'NO.02',
    ja: '切り抜き',
    en: 'CLIPS',
    title: { ja: '切り抜き', en: 'Clips' },
    href: '/clips',
    tint: '--tint-clips',
  },
  {
    id: 'discography',
    no: 'NO.03',
    ja: 'ディスコ',
    en: 'DISCO',
    title: { ja: 'ディスコグラフィ', en: 'Discography' },
    href: '/discography',
    tint: '--tint-disco',
  },
  {
    id: 'streaming',
    no: 'NO.04',
    ja: '配信',
    en: 'STREAM',
    title: { ja: '配信アーカイブ', en: 'Streaming' },
    href: '/streaming',
    tint: '--tint-stream',
  },
  {
    id: 'events',
    no: 'NO.05',
    ja: 'イベント',
    en: 'EVENTS',
    title: { ja: 'イベント', en: 'Events' },
    href: '/events',
    tint: '--tint-events',
  },
  {
    id: 'arts',
    no: 'NO.06',
    ja: 'アート',
    en: 'ARTS',
    title: { ja: 'アート', en: 'Arts' },
    href: '/arts',
    tint: '--tint-arts',
  },
  {
    id: 'messages',
    no: 'NO.07',
    ja: '寄せ書き',
    en: 'MESSAGES',
    title: { ja: '寄せ書き', en: 'Message Board' },
    href: '/messages',
    tint: '--tint-messages',
  },
];

export function chapterForPath(pathname: string): Chapter | undefined {
  const p = pathname.replace(/\/+$/, '') || '/';
  return CHAPTERS.find((c) => c.href === p);
}

export const CHAPTER_IDS = CHAPTERS.map((c) => c.id) as [ChapterId, ...ChapterId[]];
