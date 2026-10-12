/** UI strings (EXECUTIONPLAN §22). Both languages ship in the HTML; html[data-lang] picks which shows. */
import ja from '../content/i18n/ja.json';
import en from '../content/i18n/en.json';

export type Key = keyof typeof ja & keyof typeof en;
export type Pair = { ja: string; en: string };

export function t(key: Key, vars: Record<string, string | number> = {}): Pair {
  const fill = (s: string) => s.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? ''));
  return { ja: fill(ja[key]), en: fill(en[key]) };
}
/** pick one language, falling back to the other (data with I18nPartial) */
export function pick(v: { ja?: string; en?: string } | undefined, lang: 'ja' | 'en'): string {
  if (!v) return '';
  return (lang === 'ja' ? (v.ja ?? v.en) : (v.en ?? v.ja)) ?? '';
}
