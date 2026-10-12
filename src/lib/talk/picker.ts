/** Conversation + choice picking (EXECUTIONPLAN §10.4). Randomness from crypto.getRandomValues (injectable for tests). */
import type { Choice, Conversation, When } from './types';
import { DATE_SPECIFIC } from './schema';
import { matches } from './context';

export type Rand = () => number;
export const cryptoRand: Rand = () => {
  const a = new Uint32Array(1);
  crypto.getRandomValues(a);
  return a[0]! / 2 ** 32;
};

export function weighted<T>(items: T[], weight: (t: T) => number, rand: Rand): T {
  const total = items.reduce((s, t) => s + Math.max(0, weight(t)), 0);
  let r = rand() * total;
  for (const t of items) {
    r -= Math.max(0, weight(t));
    if (r < 0) return t;
  }
  return items[items.length - 1]!;
}

export function isDateSpecific(c: Conversation): boolean {
  return c.when.some((w) => DATE_SPECIFIC.has(w));
}

export function pickConversation(
  all: Conversation[],
  active: Set<When>,
  recent: string[],
  album: Record<string, string>,
  seenToday: string[],
  rand: Rand = cryptoRand,
): Conversation | null {
  const eligible = all.filter((c) => matches(c.when, active));
  if (!eligible.length) return null;
  // 1) date-specific scripts first, once per day
  const special = eligible.filter((c) => isDateSpecific(c) && !seenToday.includes(c.id));
  if (special.length) return weighted(special, (c) => c.weight, rand);
  // 2) avoid the last 8 seen this session (date-specific ones already used today are excluded too)
  const normalPool = eligible.filter((c) => !isDateSpecific(c));
  let pool = normalPool.filter((c) => !recent.includes(c.id));
  if (!pool.length) pool = normalPool.length ? normalPool : eligible;
  // 3) rare ≈ 5%
  const rare = pool.filter((c) => c.rare);
  const normal = pool.filter((c) => !c.rare);
  const source = rare.length && rand() < 0.05 ? rare : normal.length ? normal : rare;
  // 4) favour unseen: album-found conversations weigh 0.6×
  return weighted(source, (c) => c.weight * (album[c.id] ? 0.6 : 1), rand);
}

/** Pick up to 3 choices: weighted, no replacement, ≤ 1 goto, ≥ 1 non-goto, shuffled. */
export function pickChoices(choices: Choice[], rand: Rand = cryptoRand, n = 3): Choice[] {
  if (choices.length <= n && choices.filter((c) => c.goto).length <= 1) return shuffle([...choices], rand);
  const pool = [...choices];
  const out: Choice[] = [];
  const nonGoto = pool.filter((c) => !c.goto);
  if (nonGoto.length) {
    const first = weighted(nonGoto, (c) => c.weight, rand);
    out.push(first);
    pool.splice(pool.indexOf(first), 1);
  }
  while (out.length < n && pool.length) {
    const hasGoto = out.some((c) => c.goto);
    const candidates = pool.filter((c) => !(hasGoto && c.goto));
    if (!candidates.length) break;
    const c = weighted(candidates, (x) => x.weight, rand);
    out.push(c);
    pool.splice(pool.indexOf(c), 1);
  }
  return shuffle(out, rand);
}

export function shuffle<T>(a: T[], rand: Rand = cryptoRand): T[] {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}
