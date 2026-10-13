/**
 * Typed wrapper around Umami (EXECUTIONPLAN §16). No-op when window.umami is missing
 * (blocked, Do Not Track, local, preview). Never send personal data or note text.
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
  | 'cwv'
  | 'not_found';

type Props = Record<string, string | number | boolean | undefined>;
declare global {
  interface Window {
    umami?: { track: (name: string, data?: Record<string, string | number | boolean>) => void };
  }
}

export function track(name: EventName, props: Props = {}): void {
  try {
    if (typeof window === 'undefined' || !window.umami) return;
    const data: Record<string, string | number | boolean> = {};
    for (const [k, v] of Object.entries(props)) {
      if (v === undefined) continue;
      data[k] = typeof v === 'string' ? v.slice(0, 60) : v;
    }
    window.umami.track(name, data);
  } catch {
    /* analytics must never break the page */
  }
}

/** Debounce helper for filter events (§16.2: stream_filter debounced 1 s). */
export function debounced<A extends unknown[]>(fn: (...a: A) => void, ms: number) {
  let t: ReturnType<typeof setTimeout> | undefined;
  return (...a: A) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...a), ms);
  };
}
