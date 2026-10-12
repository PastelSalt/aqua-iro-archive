/** Site-wide constants. */
export const SITE_NAME = 'Aqua Iro Archive';
/** Removal / correction contact (§9.8). Open decision §29.2 — set PUBLIC_CONTACT_EMAIL before launch. */
export const CONTACT_EMAIL: string | null = import.meta.env.PUBLIC_CONTACT_EMAIL || null;
/** The maker's portfolio — credited in the splash, footer and HELP panel. */
export const PORTFOLIO = { name: 'Moesoft', url: 'https://moesoft.vercel.app' };
export const SISTER_SITES = [
  { name: 'Kotoha', url: 'https://kotoha-fansite.vercel.app' },
  { name: 'Hanon', url: 'https://hanon-fansite.vercel.app' },
  PORTFOLIO,
];
export const OFFICIAL = {
  youtube: 'https://www.youtube.com/channel/UC1opHUrw8rvnsadT-iGp7Cg',
  x: 'https://x.com/minatoaqua',
};
export const COVER_GUIDELINES = 'https://hololivepro.com/en/terms/';
