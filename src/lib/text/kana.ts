/** Katakana → hiragana (U+30A1–U+30F6 → U+3041–U+3096). Long-vowel marks and other symbols are kept. */
export function kataToHira(s: string): string {
  return s.replace(/[ァ-ヶ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60));
}

/** Search normalization shared by Streaming and Discography search: NFKC, lowercase, kata→hira. */
export function searchForm(s: string): string {
  return kataToHira(s.normalize('NFKC').toLowerCase());
}
