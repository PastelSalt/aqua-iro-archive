/**
 * Keeper formatting, shared by server pages and browser scripts (docs/plans/KEEPER-UPDATE-PLAN.md §3): one time zone
 * everywhere (the keeper's, stated on screen), grouped numbers, human durations and relative times.
 */
export const KEEPER_TZ = 'Asia/Manila';
export const KEEPER_TZ_LABEL = 'PHT';

const nf = new Intl.NumberFormat('en-US');
const compact = new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 });

export const num = (n: number | null | undefined) => (n === null || n === undefined ? '—' : nf.format(n));
export const numCompact = (n: number) => compact.format(n);
export const pct = (part: number, whole: number) => (whole ? `${Math.round((part / whole) * 100)}%` : '—');

/** 0 s · 45 s · 3 min 20 s · 6 h 12 min */
export function duration(seconds: number | null | undefined): string {
  if (seconds === null || seconds === undefined || !Number.isFinite(seconds)) return '—';
  const s = Math.round(seconds);
  if (s < 60) return `${s} s`;
  if (s < 3600) return `${Math.floor(s / 60)} min${s % 60 ? ` ${s % 60} s` : ''}`;
  const h = Math.floor(s / 3600);
  const m = Math.round((s % 3600) / 60);
  return `${h} h${m ? ` ${m} min` : ''}`;
}

const dt = new Intl.DateTimeFormat('en-GB', {
  timeZone: KEEPER_TZ,
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});
const d = new Intl.DateTimeFormat('en-GB', {
  timeZone: KEEPER_TZ,
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});
const longDate = new Intl.DateTimeFormat('en-US', { timeZone: KEEPER_TZ, dateStyle: 'full' });

/** "3 Nov 2026, 14:05" (keeper time zone) */
export const dateTime = (v: string | number | Date | null | undefined) => (v ? dt.format(new Date(v)) : '—');
export const date = (v: string | number | Date | null | undefined) => (v ? d.format(new Date(v)) : '—');
export const today = () => `${longDate.format(new Date())} · ${KEEPER_TZ_LABEL}`;

/** "just now" · "12 min ago" · "5 h ago" · "3 d ago" · "4 mo ago" · "2 y ago" (pair it with the full date) */
export function ago(v: string | number | Date | null | undefined): string {
  if (!v) return '—';
  const m = Math.round((Date.now() - new Date(v).getTime()) / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m} min ago`;
  if (m < 1440) return `${Math.round(m / 60)} h ago`;
  if (m < 1440 * 60) return `${Math.round(m / 1440)} d ago`;
  if (m < 1440 * 365) return `${Math.round(m / 43200)} mo ago`;
  return `${Math.round(m / 525600)} y ago`;
}

/** ▲ 12% / ▼ 3% against the previous period; null when there's nothing to compare */
export function change(
  now: number,
  before: number | null | undefined,
): { text: string; dir: 'up' | 'down' | 'flat' } | null {
  if (before === null || before === undefined || !Number.isFinite(before)) return null;
  if (before === 0) return now ? { text: 'new', dir: 'up' } : null;
  const p = Math.round(((now - before) / before) * 100);
  if (p === 0) return { text: '±0%', dir: 'flat' };
  return { text: `${p > 0 ? '▲' : '▼'} ${Math.abs(p)}%`, dir: p > 0 ? 'up' : 'down' };
}

/** Human words for the database's status / reason / action codes */
export const STATUS_LABEL: Record<string, string> = {
  visible: 'Visible',
  held: 'Held',
  under_review: 'Under review',
  removed: 'Removed',
};
export const REASON_LABEL: Record<string, string> = {
  spam: 'Spam',
  hate: 'Hate',
  sexual: 'Sexual',
  personal_info: 'Personal info',
  impersonation: 'Impersonation',
  other: 'Other',
};
export const ACTION_LABEL: Record<string, { label: string; icon: string; tone?: 'ok' | 'warn' | 'danger' }> =
  {
    approve: { label: 'Approved a note', icon: 'check-circle', tone: 'ok' },
    bulk_approve: { label: 'Approved notes (bulk)', icon: 'check-circle', tone: 'ok' },
    remove: { label: 'Removed a note', icon: 'x-circle', tone: 'danger' },
    bulk_remove: { label: 'Removed notes (bulk)', icon: 'x-circle', tone: 'danger' },
    restore: { label: 'Restored a note', icon: 'arrow-counter-clockwise' },
    hold: { label: 'Held a note', icon: 'pause-circle', tone: 'warn' },
    purge: { label: 'Purged a note (privacy request)', icon: 'trash', tone: 'danger' },
    settings_change: { label: 'Changed a setting', icon: 'sliders-horizontal' },
    term_add: { label: 'Added a word-list term', icon: 'funnel' },
    term_remove: { label: 'Removed a word-list term', icon: 'funnel' },
    pause: { label: 'Paused posting', icon: 'pause-circle', tone: 'warn' },
    resume: { label: 'Resumed posting', icon: 'play-circle', tone: 'ok' },
    login: { label: 'Signed in', icon: 'key' },
    login_failed: { label: 'Failed sign-in', icon: 'shield-warning', tone: 'warn' },
    twofa_reset: { label: 'Two-factor reset (command line)', icon: 'lock-key', tone: 'warn' },
  };
const HELD_REASON: Record<string, string> = {
  newcomer: 'newcomer hold',
  raid: 'busy-period hold',
  admin: 'held by the keeper',
};
export const heldReason = (r: string | null | undefined) =>
  !r ? '' : r.startsWith('term:') ? `word list (term #${r.slice(5)})` : (HELD_REASON[r] ?? r);
