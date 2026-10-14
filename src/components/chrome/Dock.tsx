/**
 * Bottom dock (DOCK-PLAN v2). Persisted across ClientRouter navigations.
 * One dock, one size: it never changes while you scroll or hover. Wide screens (≥ 1024 px) show the
 * 8 chapters and the 6 system buttons; narrower ones show 5 chapters + MORE, which opens one sheet
 * with everything. Which buttons show is decided by CSS only (styles/dock.css). The only motion of
 * its own: the current-chapter pill slides to the new chapter on a page change.
 */
import { useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks';
import { navigate } from 'astro:transitions/client';
import { CHAPTERS, chapterForPath, type Chapter } from '../../lib/chapters';
import { motion, lang, bgmOn, shortcuts, toggleMotion, toggleLang } from '../../lib/prefs';
import { track } from '../../lib/analytics';
import { timeDate } from '../../lib/aquatime';
import { useLang } from '../../lib/useLang';
import DockButton from './DockButton';

const BAR_SET = ['home', 'clips', 'discography', 'streaming', 'messages'];

function currentPath() {
  return typeof location === 'undefined' ? '/' : location.pathname.replace(/\/+$/, '') || '/';
}
function isTyping(el: EventTarget | null) {
  const t = el as HTMLElement | null;
  if (!t) return false;
  return (
    t.isContentEditable ||
    ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName) ||
    !!t.closest?.('[role="dialog"],dialog')
  );
}
const fire = (name: string) => window.dispatchEvent(new CustomEvent(name, { detail: { toggle: true } }));

export default function Dock({ initialPath = '/' }: { initialPath?: string }) {
  // server render uses the page's own path so the hydrated markup (aria-current) is right without a re-render
  const [path, setPath] = useState(
    typeof location === 'undefined' ? initialPath.replace(/\/+$/, '') || '/' : currentPath(),
  );
  const [sheet, setSheet] = useState(false);
  const navRef = useRef<HTMLElement>(null);
  const pillRef = useRef<HTMLSpanElement>(null);
  const active = chapterForPath(path);

  // --- route changes (ClientRouter keeps this island mounted) ---
  useEffect(() => {
    const onLoad = () => {
      setPath(currentPath());
      setSheet(false);
    };
    document.addEventListener('astro:page-load', onLoad);
    return () => document.removeEventListener('astro:page-load', onLoad);
  }, []);

  // --- the current-chapter pill: sits behind the current button and slides to the next one ---
  const placePill = () => {
    const nav = navRef.current;
    const pill = pillRef.current;
    if (!nav || !pill) return;
    const btn = nav.querySelector<HTMLElement>('.dock__chapters .dbtn[aria-current="page"]');
    if (!btn || !btn.offsetWidth) {
      nav.classList.remove('has-pill');
      return;
    }
    pill.style.width = `${btn.offsetWidth}px`;
    pill.style.height = `${btn.offsetHeight}px`;
    pill.style.transform = `translate(${btn.offsetLeft}px, ${btn.offsetTop}px)`;
    nav.classList.add('has-pill');
  };
  useLayoutEffect(placePill, [path]);
  useEffect(() => {
    const nav = navRef.current;
    if (!nav) return;
    // the first placement doesn't slide in from nowhere; later ones do
    const ready = requestAnimationFrame(() => nav.classList.add('pill-ready'));
    const ro = new ResizeObserver(() => {
      nav.classList.remove('pill-ready');
      placePill();
      requestAnimationFrame(() => nav.classList.add('pill-ready'));
    });
    ro.observe(nav);
    return () => {
      cancelAnimationFrame(ready);
      ro.disconnect();
    };
  }, []);

  // --- keyboard shortcuts (WCAG 2.1.4: can be turned off in the LOG drawer) ---
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented) return;
      if (e.key === 'Escape' && sheet) {
        setSheet(false);
        return;
      }
      if (isTyping(e.target)) return;
      if (e.altKey && !e.ctrlKey && !e.metaKey && (e.code === 'KeyM' || e.code === 'KeyL')) {
        if (!shortcuts.value) return;
        e.preventDefault();
        if (e.code === 'KeyM') sysMotion();
        else sysLang();
        return;
      }
      if (e.ctrlKey || e.metaKey || e.altKey || e.shiftKey) return;
      if (e.key === 'Escape') {
        if (!document.body.classList.contains('has-modal')) fire('aia:log');
        return;
      }
      if (!shortcuts.value) return;
      const n = Number(e.key);
      if (Number.isInteger(n) && n >= 1 && n <= 8) {
        const c = CHAPTERS[n - 1]!;
        if (c.href !== currentPath()) {
          e.preventDefault();
          track('dock_nav', { to: c.id, via: 'key' });
          navigate(c.href);
        }
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [sheet]);

  function onChapterClick(e: MouseEvent, c: Chapter) {
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    track('dock_nav', { to: c.id, via: 'click' });
    setSheet(false);
  }
  function sysMotion() {
    toggleMotion();
    track('sys_toggle', { what: 'motion', value: motion.value });
  }
  function sysLang() {
    toggleLang();
    track('sys_toggle', { what: 'lang', value: lang.value });
  }
  function sysBgm() {
    fire('aia:bgm');
    track('sys_toggle', { what: 'bgm', value: !bgmOn.value });
  }
  // system buttons in the sheet close it first, so the drawer / deck they open isn't stacked on it
  const fromSheet = (fn: () => void, close: boolean) => () => {
    if (close) setSheet(false);
    fn();
  };

  // roving focus for the system toolbar
  function onToolbarKey(e: KeyboardEvent) {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    const btns = Array.from((e.currentTarget as HTMLElement).querySelectorAll<HTMLButtonElement>('button'));
    const i = btns.indexOf(document.activeElement as HTMLButtonElement);
    const next = btns[(i + (e.key === 'ArrowRight' ? 1 : -1) + btns.length) % btns.length];
    next?.focus();
    e.preventDefault();
  }

  const L = useLang();
  const say = (ja: string, en: string) => (L === 'ja' ? ja : en);
  const sysButtons = (inSheet: boolean) => (
    <>
      <DockButton
        icon="music-notes"
        label="BGM"
        pressed={bgmOn.value}
        onClick={sysBgm}
        ariaLabel={say('BGM オン・オフ', 'BGM on/off')}
        attrs={{ 'data-sys': 'bgm' }}
      />
      <DockButton
        icon="sparkle"
        label="MOTION"
        pressed={motion.value === 'on'}
        onClick={sysMotion}
        ariaLabel={say('モーション オン・オフ (Alt+M)', 'Motion on/off (Alt+M)')}
        attrs={{ 'data-sys': 'motion' }}
      />
      <DockButton
        icon="translate"
        label="JP/EN"
        onClick={sysLang}
        ariaLabel={say('言語を英語に切り替え (Alt+L)', 'Switch language to Japanese (Alt+L)')}
        attrs={{ 'data-sys': 'lang' }}
      />
      <DockButton
        icon="book-open"
        label="LOG"
        onClick={fromSheet(() => fire('aia:log'), inSheet)}
        ariaLabel={say('ログを開く (Esc)', 'Open the log (Esc)')}
        attrs={{ 'data-sys': 'log' }}
      />
      <DockButton
        icon="cassette-tape"
        label="TIME"
        pressed={!!timeDate.value}
        onClick={fromSheet(() => fire('aia:time-open'), inSheet)}
        ariaLabel={say('あくあ時間（日付を旅する）', 'Aqua Time — travel to a date')}
        attrs={{ 'data-sys': 'time' }}
      />
      <DockButton
        icon="question"
        label="HELP"
        onClick={fromSheet(() => fire('aia:help'), inSheet)}
        ariaLabel={say('ヘルプ・使い方', 'Help and how-to')}
        attrs={{ 'data-sys': 'help' }}
      />
    </>
  );

  // the bar on narrow screens always includes the current chapter (it takes Clips' place)
  const barIds =
    active && !BAR_SET.includes(active.id) ? BAR_SET.map((id) => (id === 'clips' ? active.id : id)) : BAR_SET;

  const chapterButton = (c: Chapter, i: number) => (
    <DockButton
      icon={c.icon}
      tint={c.iconTint}
      label={c.label}
      href={c.href}
      current={active?.id === c.id}
      sr={`${c.no} ${c.title.en}`}
      onClick={(e) => onChapterClick(e, c)}
      attrs={{ 'aria-keyshortcuts': String(i + 1) }}
    />
  );

  return (
    <div class={`dock-host${sheet ? ' has-sheet' : ''}`}>
      <nav class="dock" aria-label={say('チャプター', 'Chapters')} ref={navRef}>
        <span class="dock__pill" aria-hidden="true" ref={pillRef} />
        <ol class="dock__chapters" role="list">
          {CHAPTERS.map((c, i) => (
            <li class={barIds.includes(c.id) ? undefined : 'is-extra'}>{chapterButton(c, i)}</li>
          ))}
          <li class="dock__more">
            <DockButton
              icon="dots-three-outline"
              label={{ ja: 'もっと', en: 'MORE' }}
              onClick={() => setSheet(true)}
              ariaLabel={say('すべてのチャプターとシステム', 'All chapters and system')}
              attrs={{ 'aria-expanded': sheet, 'aria-haspopup': 'dialog' }}
            />
          </li>
        </ol>
        <div class="dock__sys" role="toolbar" aria-label={say('システム', 'System')} onKeyDown={onToolbarKey}>
          {sysButtons(false)}
        </div>
      </nav>

      {sheet && (
        <>
          <div class="scrim dock-sheet__scrim" onClick={() => setSheet(false)} />
          <div
            class="dock-sheet"
            role="dialog"
            aria-modal="true"
            aria-label={say('チャプターとシステム', 'Chapters and system')}
          >
            <div class="dock-sheet__head">
              <span class="ribbon">
                CHAPTER SELECT <small>チャプター</small>
              </span>
              <button
                type="button"
                class="btn btn--ghost btn--icon"
                aria-label={say('閉じる', 'Close')}
                onClick={() => setSheet(false)}
                autoFocus
              >
                <svg class="icon" aria-hidden="true" focusable="false">
                  <use href="#i-close" />
                </svg>
              </button>
            </div>
            <ol class="dock-sheet__grid" role="list">
              {CHAPTERS.map((c, i) => (
                <li>{chapterButton(c, i)}</li>
              ))}
            </ol>
            <div class="dock-sheet__sys" role="group" aria-label={say('システム', 'System')}>
              {sysButtons(true)}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
