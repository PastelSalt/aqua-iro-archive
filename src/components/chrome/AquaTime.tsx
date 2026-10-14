/**
 * 「あくあ時間」 Aqua Time (IMPROVEMENT-PLAN Part 2 A). A VHS-style tape deck opened from the dock's
 * TIME button: drag the scrubber (or step by day / week / month) to any day from her debut to her
 * graduation, or jump to "On this day". The whole archive then shows that day: the Home outfit, the
 * Talk greeting, the stream log, the discography and the counters. A badge under the logo tab shows
 * where you are and returns you to the present. Once per session, an "On this day" toast lists what
 * happened on today's date in past years. Everything comes from /aqua-time.json (existing archive data).
 */
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { useLang } from '../../lib/useLang';
import { track } from '../../lib/analytics';
import { read, write } from '../../lib/storage';
import {
  START,
  END,
  DAYS,
  addDays,
  between,
  daysBetween,
  greeting,
  dot,
  loadIndex,
  onThisDay,
  season,
  setTime,
  timeDate,
  upTo,
  type Index,
} from '../../lib/aquatime';

const TOAST_KEY = 'aia:onthisday';
const SEASON = {
  spring: { ja: '春', en: 'Spring' },
  summer: { ja: '夏', en: 'Summer' },
  autumn: { ja: '秋', en: 'Autumn' },
  winter: { ja: '冬', en: 'Winter' },
};

/** today's month-day in Japan time */
const jstToday = () => new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10);

export default function AquaTime() {
  const L = useLang();
  const ja = L === 'ja';
  const say = (j: string, e: string) => (ja ? j : e);
  const [open, setOpen] = useState(false);
  const [ix, setIx] = useState<Index | null>(null);
  const [failed, setFailed] = useState(false);
  const [draft, setDraft] = useState<string>(timeDate.value ?? END);
  const [rewinding, setRewinding] = useState(false);
  const [toast, setToast] = useState<null | { md: string; items: ReturnType<typeof onThisDay> }>(null);
  const panel = useRef<HTMLDivElement>(null);
  const returnTo = useRef<HTMLElement | null>(null);
  const current = timeDate.value;

  // open / close from the dock
  useEffect(() => {
    const onOpen = (e: Event) => {
      const t = (e as CustomEvent<{ toggle?: boolean }>).detail?.toggle;
      setOpen((v) => (t ? !v : true));
    };
    const close = () => setOpen(false);
    window.addEventListener('aia:time-open', onOpen);
    window.addEventListener('aia:help', close);
    window.addEventListener('aia:log', close);
    document.addEventListener('astro:before-swap', close);
    return () => {
      window.removeEventListener('aia:time-open', onOpen);
      window.removeEventListener('aia:help', close);
      window.removeEventListener('aia:log', close);
      document.removeEventListener('astro:before-swap', close);
    };
  }, []);

  // load the index when needed
  useEffect(() => {
    if (!open || ix) return;
    loadIndex()
      .then(setIx)
      .catch(() => setFailed(true));
  }, [open]);

  // focus + Esc + return focus
  useEffect(() => {
    if (!open) {
      returnTo.current?.focus?.();
      returnTo.current = null;
      return;
    }
    returnTo.current = document.activeElement as HTMLElement;
    setDraft(timeDate.value ?? draft);
    requestAnimationFrame(() => panel.current?.querySelector<HTMLElement>('input[type=range]')?.focus());
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        setOpen(false);
      }
    };
    document.addEventListener('keydown', onKey, true);
    track('time_open');
    return () => document.removeEventListener('keydown', onKey, true);
  }, [open]);

  // "On this day": once per browser session, a few seconds after arriving (not over the splash/tour)
  useEffect(() => {
    let seen = false;
    try {
      seen = sessionStorage.getItem(TOAST_KEY) === '1';
    } catch {
      seen = true;
    }
    if (seen || read<boolean>('aia:onthisday.off', false)) return;
    const t = setTimeout(() => {
      if (document.querySelector('.tour, [data-splash-root]')) return;
      const md = jstToday().slice(5);
      loadIndex()
        .then((data) => {
          const items = onThisDay(data, md);
          try {
            sessionStorage.setItem(TOAST_KEY, '1');
          } catch {
            /* ignore */
          }
          if (items.length) setToast({ md, items: items.slice(0, 3) });
        })
        .catch(() => undefined);
    }, 4500);
    return () => clearTimeout(t);
  }, []);

  // the toast steps aside by itself: after 14 s, or when you move to another page
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 14000);
    const off = () => setToast(null);
    document.addEventListener('astro:before-swap', off);
    return () => {
      clearTimeout(t);
      document.removeEventListener('astro:before-swap', off);
    };
  }, [toast]);

  const view = useMemo(() => {
    if (!ix) return null;
    const d = draft;
    const day = daysBetween(START, d) + 1;
    const weekFrom = addDays(d, -3);
    const weekTo = addDays(d, 3);
    const streamsSoFar = upTo(ix.streams, d);
    const hours = Math.round(ix.streams.slice(0, streamsSoFar).reduce((s, r) => s + (r.s ?? 0), 0) / 3600);
    const songsSoFar = ix.songs.slice(0, upTo(ix.songs, d));
    const latestSong = songsSoFar.at(-1);
    const latestEvent = ix.events.slice(0, upTo(ix.events, d)).at(-1);
    return {
      day,
      streamsSoFar,
      hours,
      songsSoFar: songsSoFar.length,
      latestSong,
      latestEvent,
      week: between(ix.streams, weekFrom, weekTo).slice(0, 6),
      events: between(ix.events, weekFrom, weekTo),
      line: greeting(ix, d, ja),
      season: season(d),
    };
  }, [ix, draft, ja]);

  const scrub = (v: number) => {
    setDraft(addDays(START, Math.max(0, Math.min(DAYS, v))));
  };
  const travel = (d: string, how: string) => {
    setTime(d);
    setDraft(d);
    track('time_travel', { to: d.slice(0, 7), how });
    document.documentElement.classList.add('time-snap');
    setTimeout(() => document.documentElement.classList.remove('time-snap'), 420);
  };
  const present = () => {
    setTime(null);
    track('time_travel', { to: 'present', how: 'badge' });
  };
  const onThisDayJump = () => {
    // the latest year (≤ 2024, within her six years) that had this month/day
    const md = jstToday().slice(5);
    for (let y = 2024; y >= 2018; y--) {
      const d = `${y}-${md}`;
      if (d >= START && d <= END) return travel(d, 'onthisday');
    }
  };

  const kind = (k: string) =>
    ({
      event: say('できごと', 'Event'),
      song: say('歌', 'Song'),
      stream: say('配信', 'Stream'),
      art: say('アート', 'Art'),
    })[k] ?? k;

  return (
    <>
      {/* where you are in time — under the logo tab, any page */}
      {current && (
        <button
          type="button"
          class="time-badge"
          onClick={() => setOpen(true)}
          aria-label={say(`あくあ時間：${dot(current)}（開く）`, `Aqua Time: ${dot(current)} (open)`)}
        >
          <span class="time-badge__rec" aria-hidden="true">
            ◀◀
          </span>
          <span class="num">{dot(current)}</span>
          <span
            class="time-badge__x"
            role="button"
            tabIndex={0}
            aria-label={say('現在に戻る', 'Back to the present')}
            onClick={(e) => {
              e.stopPropagation();
              present();
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                e.stopPropagation();
                present();
              }
            }}
          >
            {say('現在へ', 'Now')} ▶
          </span>
        </button>
      )}

      {open && (
        <>
          <div class="scrim" onClick={() => setOpen(false)} />
          <div
            ref={panel}
            class={`timedeck${rewinding ? ' is-rewinding' : ''}`}
            role="dialog"
            aria-modal="true"
            aria-labelledby="timedeck-title"
          >
            <div class="timedeck__head">
              <h2 id="timedeck-title">
                <span lang="ja">あくあ時間</span> <small lang="en">AQUA TIME</small>
              </h2>
              <button
                type="button"
                class="btn btn--ghost btn--icon"
                aria-label={say('閉じる', 'Close')}
                onClick={() => setOpen(false)}
              >
                <svg class="icon" aria-hidden="true">
                  <use href="#i-close" />
                </svg>
              </button>
            </div>

            <div class="timedeck__screen">
              <span class="timedeck__mode" aria-hidden="true">
                {rewinding ? '◀◀ REW' : current === draft ? '▶ PLAY' : '❚❚ PAUSE'}
              </span>
              <output class="timedeck__counter num" aria-live="polite">
                {dot(draft)}
              </output>
              <span class="timedeck__sub num">
                {view
                  ? say(
                      `DAY ${view.day.toLocaleString('en-US')} / ${(DAYS + 1).toLocaleString('en-US')} · ${SEASON[view.season].ja}`,
                      `DAY ${view.day.toLocaleString('en-US')} OF ${(DAYS + 1).toLocaleString('en-US')} · ${SEASON[view.season].en.toUpperCase()}`,
                    )
                  : '…'}
              </span>
            </div>

            <label class="timedeck__track">
              <span class="sr-only">{say('日付', 'Date')}</span>
              <input
                type="range"
                min={0}
                max={DAYS}
                step={1}
                value={daysBetween(START, draft)}
                aria-valuetext={dot(draft)}
                onInput={(e) => {
                  setRewinding(true);
                  scrub(Number((e.target as HTMLInputElement).value));
                }}
                onChange={() => setRewinding(false)}
                onPointerUp={() => setRewinding(false)}
                onKeyUp={() => setRewinding(false)}
              />
              <span class="timedeck__ends num" aria-hidden="true">
                <span>{dot(START)}</span>
                <span>{dot(END)}</span>
              </span>
            </label>

            <div class="timedeck__btns">
              {(
                [
                  [-30, '−1M'],
                  [-7, '−1W'],
                  [-1, '−1D'],
                  [1, '+1D'],
                  [7, '+1W'],
                  [30, '+1M'],
                ] as const
              ).map(([n, t]) => (
                <button type="button" class="chip" onClick={() => scrub(daysBetween(START, draft) + n)}>
                  {t}
                </button>
              ))}
            </div>

            {failed && (
              <p class="muted">{say('データを読み込めませんでした。', "Couldn't load the archive index.")}</p>
            )}

            {view && (
              <div class="timedeck__body">
                <p class="timedeck__line">
                  <b>{say('あくあ', 'AQUA')}</b> {view.line}
                  <small class="credit">
                    {say('※ファン創作のセリフです', 'Fan-written line, not her words')}
                  </small>
                </p>
                <dl class="timedeck__stats">
                  <div>
                    <dt>{say('ここまでの配信', 'Streams so far')}</dt>
                    <dd class="num">{view.streamsSoFar}</dd>
                  </div>
                  <div>
                    <dt>{say('配信時間', 'Hours')}</dt>
                    <dd class="num">{view.hours.toLocaleString('en-US')}</dd>
                  </div>
                  <div>
                    <dt>{say('歌', 'Songs')}</dt>
                    <dd class="num">{view.songsSoFar}</dd>
                  </div>
                </dl>
                {view.latestSong && (
                  <p class="timedeck__now">
                    <span class="label">{say('いちばん新しい歌', 'Newest song by then')}</span>{' '}
                    {view.latestSong.t} <span class="num muted">{dot(view.latestSong.d)}</span>
                  </p>
                )}
                {view.events.length > 0 && (
                  <ul class="timedeck__list" role="list">
                    {view.events.map((e) => (
                      <li>
                        <span class="num">{dot(e.d)}</span> {ja ? e.t : e.e || e.t}
                      </li>
                    ))}
                  </ul>
                )}
                <p class="label">{say('この週の配信', 'Streams that week')}</p>
                {view.week.length ? (
                  <ul class="timedeck__list" role="list">
                    {view.week.map((s) => (
                      <li>
                        <span class="num">{dot(s.d)}</span>{' '}
                        <a
                          href={`https://www.youtube.com/watch?v=${s.u}`}
                          target="_blank"
                          rel="noopener"
                          lang="ja"
                        >
                          {s.t}
                        </a>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p class="muted">
                    {say('この週の配信アーカイブは残っていません。', 'No archived streams that week.')}
                  </p>
                )}
              </div>
            )}

            <div class="timedeck__actions">
              <button type="button" class="btn btn--secondary" onClick={onThisDayJump}>
                {say('今日の日付へ', 'On this day')}
              </button>
              {current && (
                <button type="button" class="btn btn--ghost" onClick={present}>
                  {say('現在に戻る', 'Back to now')}
                </button>
              )}
              <button
                type="button"
                class="btn btn--primary"
                onClick={() => travel(draft, 'scrub')}
                disabled={draft === current}
              >
                ▶ {say('この日へ行く', 'Go to this day')}
              </button>
            </div>
          </div>
        </>
      )}

      {toast && !open && (
        <aside class="otd" role="status" aria-label={say('今日はなんの日', 'On this day')}>
          <p class="otd__head">
            <b>{say('今日はなんの日？', 'On this day')}</b>{' '}
            <span class="num">{toast.md.replace('-', '.')}</span>
          </p>
          <ul role="list">
            {toast.items.map((r) => {
              const ago = Number(jstToday().slice(0, 4)) - Number(r.d.slice(0, 4));
              return (
                <li>
                  <span class="otd__ago">{say(`${ago}年前`, `${ago} yr${ago === 1 ? '' : 's'} ago`)}</span>{' '}
                  <span class="otd__kind">{kind(r.kind)}</span> {ja ? r.t : r.e || r.t}
                </li>
              );
            })}
          </ul>
          <div class="otd__btns">
            <button
              type="button"
              class="btn btn--primary"
              onClick={() => {
                const d = toast.items[0]!.d;
                setToast(null);
                travel(d, 'toast');
                setOpen(true);
              }}
            >
              ◀◀ {say('その日へ', 'Travel there')}
            </button>
            <button type="button" class="btn btn--ghost" onClick={() => setToast(null)}>
              {say('とじる', 'Close')}
            </button>
            <button
              type="button"
              class="otd__off"
              onClick={() => {
                write('aia:onthisday.off', true);
                setToast(null);
              }}
            >
              {say('今後表示しない', "Don't show again")}
            </button>
          </div>
        </aside>
      )}
    </>
  );
}
