/** Word filter (EXECUTIONPLAN §12.4 step 10): `obscenity` English matcher + DB-managed blocked_terms (cached 60 s). */
import { RegExpMatcher, englishDataset, englishRecommendedTransformers } from 'obscenity';
import { blockedTerms } from '../db/schema';
import type { DB } from '../db/types';
import { compareForm } from '../../lib/text/normalize';

const english = new RegExpMatcher({ ...englishDataset.build(), ...englishRecommendedTransformers });

export type Term = {
  id: number;
  term: string;
  kind: 'substring' | 'word' | 'regex';
  action: 'hold' | 'reject';
};
let cache: { at: number; terms: Term[] } | null = null;

export async function loadTerms(db: DB, fresh = false): Promise<Term[]> {
  if (!fresh && cache && Date.now() - cache.at < 60_000) return cache.terms;
  const terms = (await db
    .select({
      id: blockedTerms.id,
      term: blockedTerms.term,
      kind: blockedTerms.kind,
      action: blockedTerms.action,
    })
    .from(blockedTerms)) as Term[];
  cache = { at: Date.now(), terms };
  return terms;
}
export function _resetTermsCache() {
  cache = null;
}

function termMatches(t: Term, raw: string, cmp: string): boolean {
  try {
    if (t.kind === 'regex') return new RegExp(t.term, 'iu').test(raw.normalize('NFKC'));
    const needle = compareForm(t.term);
    if (!needle) return false;
    if (t.kind === 'word')
      return new RegExp(
        `(^|[^\\p{L}\\p{N}])${needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^\\p{L}\\p{N}]|$)`,
        'u',
      ).test(raw.normalize('NFKC').toLowerCase());
    return cmp.includes(needle);
  } catch {
    return false;
  }
}

export type FilterResult = { action: 'ok' } | { action: 'hold' | 'reject'; reason: string; termId?: number };

/** `reject` wins over `hold`. English profanity holds (the keeper decides) rather than rejecting outright. */
export function runFilter(text: string, terms: Term[]): FilterResult {
  const cmp = compareForm(text);
  let hold: FilterResult | null = null;
  for (const t of terms) {
    if (!termMatches(t, text, cmp)) continue;
    if (t.action === 'reject') return { action: 'reject', reason: `term:${t.id}`, termId: t.id };
    hold ??= { action: 'hold', reason: `term:${t.id}`, termId: t.id };
  }
  if (hold) return hold;
  if (english.hasMatch(text)) return { action: 'hold', reason: 'term:obscenity' };
  return { action: 'ok' };
}

/** Which terms match a sentence — for the keeper's "test a sentence" box. */
export function testSentence(text: string, terms: Term[]): { terms: Term[]; english: boolean } {
  const cmp = compareForm(text);
  return { terms: terms.filter((t) => termMatches(t, text, cmp)), english: english.hasMatch(text) };
}
