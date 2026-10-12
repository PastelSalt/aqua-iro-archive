/** Dates (JST), durations and compact view counts (EXECUTIONPLAN §22). */

/** "2024-08-28" | "2024-08" | "2024" → "2024.08.28" | "2024.08" | "2024" */
export function dotDate(d: string): string {
  return d.replace(/-/g, '.');
}

/** ISO timestamp → JST "YYYY.MM.DD" */
export function jstDate(iso: string | Date): string {
  const t = typeof iso === 'string' ? new Date(iso) : iso;
  const j = new Date(t.getTime() + 9 * 3600_000);
  return `${j.getUTCFullYear()}.${String(j.getUTCMonth() + 1).padStart(2, '0')}.${String(j.getUTCDate()).padStart(2, '0')}`;
}

/** seconds → "h:mm" (e.g. 4780 → "1:19") */
export function hmm(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  return `${h}:${String(m).padStart(2, '0')}`;
}

/** seconds → "11 h 55 min" / "11時間55分" */
export function longDuration(sec: number, lang: 'ja' | 'en'): string {
  const h = Math.floor(sec / 3600);
  const m = Math.round((sec % 3600) / 60);
  return lang === 'ja' ? `${h}時間${m}分` : `${h} h ${m} min`;
}

/** 8909059 → "8.91M"; 12345 → "12.3K"; 999 → "999" */
export function compactEn(n: number): string {
  if (n >= 1e6) return `${trim((n / 1e6).toFixed(n >= 1e7 ? 1 : 2))}M`;
  if (n >= 1e3) return `${trim((n / 1e3).toFixed(n >= 1e5 ? 0 : 1))}K`;
  return String(n);
}
/** 8909059 → "891万"; 38200000 → "3820万"; 120000000 → "1.2億" */
export function compactJa(n: number): string {
  if (n >= 1e8) return `${trim((n / 1e8).toFixed(1))}億`;
  if (n >= 1e4) return `${Math.round(n / 1e4).toLocaleString('ja-JP')}万`;
  return n.toLocaleString('ja-JP');
}
function trim(s: string) {
  return s.replace(/\.0+$/, '').replace(/(\.\d*?)0+$/, '$1');
}

export function thousands(n: number): string {
  return n.toLocaleString('en-US');
}

export const SNAPSHOT_DATE = '2026-10-11';
