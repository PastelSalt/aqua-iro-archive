/**
 * The site's own cookieless analytics (docs/plans/ANALYTICS-REBUILD-PLAN.md), after moekoworks_official's track.ts:
 * events are queued in memory and sent in batches to /api/hi with sendBeacon (a page view right away; other events
 * within 4 s, when the page is hidden or closed, or every 25). A random visit id lives only in memory for this tab.
 * Never send personal data or note text.
 *
 * Not counted: browsers signed in to the Keeper (the server sees its cookie), and browsers that opted out on
 * Keeper → My account (src/lib/analytics-optout.ts: nothing leaves the browser).
 * Debugging: open any page with `?debug-analytics` (or `?debug-analytics=off` to stop) and every event, and the
 * server's answer (`X-Track: ok:n` / `dropped:<reason>`), is logged to the console.
 */
import { isOptedOut } from './analytics-optout';

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

const ENDPOINT = '/api/hi';
const DEBUG_KEY = 'aia-debug-analytics';
const browser = typeof window !== 'undefined';
const store = {
  get: (k: string) => {
    try {
      return localStorage.getItem(k);
    } catch {
      return null;
    }
  },
  set: (k: string, v: string | null) => {
    try {
      if (v === null) localStorage.removeItem(k);
      else localStorage.setItem(k, v);
    } catch {
      /* private mode */
    }
  },
};
if (browser) {
  const q = new URLSearchParams(location.search).get('debug-analytics');
  if (q !== null) store.set(DEBUG_KEY, q === 'off' ? null : '1');
}
const debug = browser && store.get(DEBUG_KEY) === '1';
const log = (...a: unknown[]) => {
  if (debug) console.info('%c[analytics]', 'color:#2aa', ...a);
};
const optedOut = isOptedOut;
export const countingOn = () => !optedOut();

const visitId = browser
  ? (crypto.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`)
  : '';
const queue: Queued[] = [];
let referrerSent = false;
let timer: ReturnType<typeof setTimeout> | undefined;

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

// visible time on each page
let pagePath = '';
let visibleSince = 0;
let pageMs = 0;
const pauseClock = () => {
  if (visibleSince) pageMs += performance.now() - visibleSince;
  visibleSince = 0;
};
function closePage() {
  pauseClock();
  if (pagePath && pageMs >= 1000) queue.push({ t: 'page_dwell', p: pagePath, ms: Math.round(pageMs) });
  pageMs = 0;
}

export function flush(): void {
  clearTimeout(timer);
  timer = undefined;
  if (!browser || !queue.length) return;
  const events = queue.splice(0, 50);
  if (optedOut()) {
    log('opted out on this browser: not sent', events);
    return;
  }
  const body = JSON.stringify({
    v: visitId,
    d: device(),
    l: document.documentElement.dataset.lang === 'en' ? 'en' : 'ja',
    r: events.some((e) => e.t === 'page_view') ? referrerHost() : '',
    p: location.pathname,
    e: events,
  });
  if (debug) {
    // fetch instead of a beacon, so the server's answer can be shown
    fetch(ENDPOINT, { method: 'POST', body, keepalive: true, headers: { 'content-type': 'text/plain' } })
      .then((r) => log(r.status, r.headers.get('X-Track') ?? '(no X-Track header)', events))
      .catch((e) => log('not sent (blocked by an extension or offline?)', e, events));
    return;
  }
  try {
    if (navigator.sendBeacon?.(ENDPOINT, new Blob([body], { type: 'text/plain' }))) return;
  } catch {
    /* fall through */
  }
  fetch(ENDPOINT, { method: 'POST', body, keepalive: true, headers: { 'content-type': 'text/plain' } }).catch(
    () => {},
  );
}

function enqueue(e: Queued, now = false) {
  queue.push(e);
  log('queued', e);
  if (now || queue.length >= 25) flush();
  // don't rely on page hide alone: beacons sent while a page is torn down are sometimes lost
  else timer ??= setTimeout(flush, 4000);
}

export function track(name: EventName, props: Props = {}): void {
  try {
    if (!browser) return;
    const x: Record<string, string | number | boolean> = {};
    for (const [k, v] of Object.entries(props))
      if (v !== undefined) x[k] = typeof v === 'string' ? v.slice(0, 60) : v;
    enqueue({ t: name, p: location.pathname, ...(Object.keys(x).length ? { x } : {}) });
  } catch {
    /* analytics must never break the page */
  }
}

if (browser) {
  if (debug) log(`debug on (visit ${visitId})${optedOut() ? ', but this browser is opted out' : ''}`);
  // a page view on the first load and on every page change (ClientRouter fires astro:page-load for both)
  document.addEventListener('astro:page-load', () => {
    closePage();
    pagePath = location.pathname;
    visibleSince = document.visibilityState === 'visible' ? performance.now() : 0;
    enqueue({ t: 'page_view', p: pagePath }, true);
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
