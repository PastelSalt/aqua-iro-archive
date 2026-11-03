/**
 * The site's own cookieless analytics (docs/ANALYTICS-PLAN.md), after the Kotoha fan site's track.js: events are
 * queued in memory and sent in batches to /api/track with sendBeacon (when the page is hidden or closed, every
 * 25 events, and right away for a page view). A random visit id lives only in memory for this tab; nothing is
 * stored in the browser. Do Not Track / Global Privacy Control turn it off. Never send personal data or note text.
 */
export type EventName =
  | 'dock_nav'
  | 'sys_toggle'
  | 'log_open'
  | 'moment_open'
  | 'chapter_card'
  | 'embed_play'
  | 'bgm_play'
  | 'clip_open'
  | 'clip_filter'
  | 'song_play'
  | 'disco_tab'
  | 'disco_view'
  | 'stream_open'
  | 'stream_filter'
  | 'stream_search'
  | 'event_open'
  | 'art_open'
  | 'art_section'
  | 'talk_start'
  | 'talk_choice'
  | 'talk_end'
  | 'talk_goto'
  | 'talk_hide'
  | 'album_open'
  | 'note_post'
  | 'note_undo'
  | 'note_report'
  | 'board_sort'
  | 'board_more'
  | 'outbound'
  | 'help_open'
  | 'tour'
  | 'tour_replay'
  | 'outfit_pick'
  | 'time_open'
  | 'time_travel'
  | 'cwv'
  | 'not_found';

type Props = Record<string, string | number | boolean | undefined>;
type Queued = { t: string; p?: string; ms?: number; x?: Record<string, string | number | boolean> };

const ENDPOINT = '/api/track';
const browser = typeof window !== 'undefined';
const off =
  !browser ||
  navigator.doNotTrack === '1' ||
  (navigator as Navigator & { globalPrivacyControl?: boolean }).globalPrivacyControl === true ||
  location.pathname.startsWith('/keeper');
const visitId = browser
  ? (crypto.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`)
  : '';
/** false with Do Not Track / Global Privacy Control, on the Keeper, and on the server */
export const trackingOn = !off;
const queue: Queued[] = [];
let referrerSent = false;

const device = () =>
  !matchMedia('(pointer: coarse)').matches
    ? 'desktop'
    : Math.min(screen.width, screen.height) < 600
      ? 'mobile'
      : 'tablet';
function referrerHost() {
  if (referrerSent) return '';
  referrerSent = true;
  try {
    const host = document.referrer ? new URL(document.referrer).hostname : '';
    return host && host !== location.hostname ? host : '';
  } catch {
    return '';
  }
}

// time on each page, counted only while the tab is visible
let pagePath = '';
let visibleSince = 0;
let pageMs = 0;
const pauseClock = () => {
  if (visibleSince) pageMs += performance.now() - visibleSince;
  visibleSince = 0;
};
function closePage() {
  pauseClock();
  if (pagePath && pageMs >= 1000) queue.push({ t: 'page_time', p: pagePath, ms: Math.round(pageMs) });
  pageMs = 0;
}

export function flush(): void {
  if (off || !queue.length) return;
  const body = JSON.stringify({
    v: visitId,
    d: device(),
    l: document.documentElement.dataset.lang === 'en' ? 'en' : 'ja',
    r: queue.some((e) => e.t === 'page_view') ? referrerHost() : '',
    p: location.pathname,
    e: queue.splice(0),
  });
  try {
    if (navigator.sendBeacon?.(ENDPOINT, body)) return;
  } catch {
    /* fall through */
  }
  fetch(ENDPOINT, { method: 'POST', body, keepalive: true }).catch(() => {});
}

export function track(name: EventName, props: Props = {}): void {
  try {
    if (off) return;
    const x: Record<string, string | number | boolean> = {};
    for (const [k, v] of Object.entries(props))
      if (v !== undefined) x[k] = typeof v === 'string' ? v.slice(0, 60) : v;
    queue.push({ t: name, p: location.pathname, ...(Object.keys(x).length ? { x } : {}) });
    if (queue.length >= 25) flush();
  } catch {
    /* analytics must never break the page */
  }
}

if (!off) {
  // a page view on the first load and on every page change (ClientRouter fires astro:page-load for both)
  document.addEventListener('astro:page-load', () => {
    closePage();
    pagePath = location.pathname;
    visibleSince = document.visibilityState === 'visible' ? performance.now() : 0;
    queue.push({ t: 'page_view', p: pagePath });
    flush();
  });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      closePage();
      flush();
    } else visibleSince = performance.now();
  });
  addEventListener('pagehide', () => {
    closePage();
    flush();
  });
}

/** Debounce helper for filter events (§16.2: stream_filter debounced 1 s). */
export function debounced<A extends unknown[]>(fn: (...a: A) => void, ms: number) {
  let t: ReturnType<typeof setTimeout> | undefined;
  return (...a: A) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...a), ms);
  };
}
