/** Context triggers, computed in the browser from the visitor's local clock (EXECUTIONPLAN §10.4). */
import type { When } from './types';

export type Context = { now: Date; firstVisit: boolean };

export function timeOfDay(d: Date): 'morning' | 'day' | 'evening' | 'night' {
  const h = d.getHours();
  if (h >= 5 && h < 11) return 'morning';
  if (h >= 11 && h < 17) return 'day';
  if (h >= 17 && h < 22) return 'evening';
  return 'night';
}

export function dateFlags(d: Date): When[] {
  const m = d.getMonth() + 1;
  const day = d.getDate();
  const out: When[] = [];
  if (m === 12 && day === 1) out.push('birthday');
  if (m === 8 && day === 8) out.push('anniversary');
  if (m === 8 && day === 28) out.push('graduation');
  return out;
}

/** Every context value that is true right now. */
export function activeContexts(ctx: Context): Set<When> {
  return new Set<When>([
    'any',
    timeOfDay(ctx.now),
    ...dateFlags(ctx.now),
    ctx.firstVisit ? 'first-visit' : 'returning',
  ]);
}

export function matches(when: When[], active: Set<When>): boolean {
  return when.some((w) => active.has(w));
}
