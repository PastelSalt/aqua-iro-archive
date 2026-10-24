/**
 * Safe browser storage (Appendix B). Every read/write is wrapped in try/catch so the site works
 * in private windows, with blocked storage, and during prerender (no window).
 */
type Kind = 'local' | 'session';
const MAX_BYTES = 64 * 1024;

function store(kind: Kind): Storage | null {
  try {
    if (typeof window === 'undefined') return null;
    return kind === 'local' ? window.localStorage : window.sessionStorage;
  } catch {
    return null;
  }
}

export function read<T>(key: string, fallback: T, kind: Kind = 'local'): T {
  try {
    const raw = store(kind)?.getItem(key);
    if (raw == null) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function write(key: string, value: unknown, kind: Kind = 'local'): void {
  try {
    const raw = JSON.stringify(value);
    if (raw.length > MAX_BYTES) return;
    store(kind)?.setItem(key, raw);
  } catch {
    /* storage full or blocked: ignore, nothing depends on it */
  }
}

export function remove(key: string, kind: Kind = 'local'): void {
  try {
    store(kind)?.removeItem(key);
  } catch {
    /* ignore */
  }
}

export const KEYS = {
  prefs: 'aia:prefs',
  dockHint: 'aia:hint.dock',
  visited: 'aia:visited',
  talkAlbum: 'aia:talk.album',
  talkHidden: 'aia:talk.hidden',
  talkRecent: 'aia:talk.recent',
  talkSeenToday: 'aia:talk.today',
  boardMine: 'aia:board.mine',
  boardDraft: 'aia:board.draft',
  boardReported: 'aia:board.reported',
  boardSort: 'aia:board.sort',
  tourDone: 'aia:tour.done',
  heroOutfit: 'aia:hero.outfit',
  /** sessionStorage: the splash has shown in this browser session */
  splashSession: 'aia:splash',
  /** sessionStorage: HELP → "Replay the tour" asked for the splash + tour after the reload */
  replay: 'aia:replay',
  /** the loading screen's title screen has been seen (first-ever visit only; FULL-UPDATE-PLAN §B2) */
  titleSeen: 'aia:title',
  /** the last chapter page visited, for the title screen's つづきから */
  lastChapter: 'aia:last',
} as const;
