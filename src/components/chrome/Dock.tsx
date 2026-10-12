/**
 * Bottom VN dock (EXECUTIONPLAN §7.3). Persisted across ClientRouter navigations.
 * States: expanded (top / near bottom edge / focus / 2 s idle) · compact (scrolling down) · peek (fast scroll on long pages).
 */
import { useEffect, useRef, useState } from 'preact/hooks';
import { navigate } from 'astro:transitions/client';
import { CHAPTERS, chapterForPath, type Chapter } from '../../lib/chapters';
import { motion, lang, bgmOn, shortcuts, toggleMotion, toggleLang } from '../../lib/prefs';
import { KEYS, read, write } from '../../lib/storage';
import { track } from '../../lib/analytics';

type DockState = 'expanded' | 'compact' | 'peek';
const LONG_PAGES = new Set(['/streaming', '/arts', '/messages']);
const MOBILE_SET = ['home', 'clips', 'discography', 'streaming', 'messages'];

const Icon = ({ name, cls = 'icon' }: { name: string; cls?: string }) => (
  <svg class={cls} aria-hidden="true" focusable="false">
    <use href={`#i-${name}`} />
  </svg>
);

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
function openLog() {
  window.dispatchEvent(new CustomEvent('aia:log', { detail: { toggle: true } }));
}
function toggleBgm() {
  window.dispatchEvent(new CustomEvent('aia:bgm', { detail: { toggle: true } }));
}

export default function Dock({ initialPath = '/' }: { initialPath?: string }) {
  // server render uses the page's own path so the hydrated markup (aria-current) is right without a re-render
  const [path, setPath] = useState(
    typeof location === 'undefined' ? initialPath.replace(/\/+$/, '') || '/' : currentPath(),
  );
  const [state, setState] = useState<DockState>('expanded');
  const [plate, setPlate] = useState('');
  const [typing, setTyping] = useState(false);
  const [sheet, setSheet] = useState(false);
  const [sysPop, setSysPop] = useState(false);
  const [hint, setHint] = useState(false);
  const hostRef = useRef<HTMLDivElement>(null);
  const active = chapterForPath(path);

  // --- route changes (ClientRouter keeps this island mounted) ---
  useEffect(() => {
    const onLoad = () => {
      setPath(currentPath());
      setSheet(false);
      setSysPop(false);
    };
    document.addEventListener('astro:page-load', onLoad);
    setHint(!read<boolean>(KEYS.dockHint, false));
    return () => document.removeEventListener('astro:page-load', onLoad);
  }, []);

  // --- name plate types in like dialogue ---
  useEffect(() => {
    const full = active ? `${active.no} · ${active.en}` : 'AQUA IRO ARCHIVE';
    if (motion.value !== 'on') {
      setPlate(full);
      setTyping(false);
      return;
    }
    let i = 0;
    setTyping(true);
    setPlate('');
    const id = setInterval(() => {
      i++;
      setPlate(full.slice(0, i));
      if (i >= full.length) {
        clearInterval(id);
        setTyping(false);
      }
    }, 80);
    return () => clearInterval(id);
  }, [path]);

  // --- scroll-driven states ---
  useEffect(() => {
    let lastY = window.scrollY;
    let lastT = performance.now();
    let idle: ReturnType<typeof setTimeout> | undefined;
    let focused = false;
    let raf = 0;
    const host = hostRef.current;
    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        const y = window.scrollY;
        const now = performance.now();
        const dy = y - lastY;
        const v = (Math.abs(dy) / Math.max(1, now - lastT)) * 1000;
        lastY = y;
        lastT = now;
        if (focused) return;
        if (y < 80) setState('expanded');
        else if (dy > 0 && v > 1200 && LONG_PAGES.has(currentPath())) setState('peek');
        else if (dy > 0) setState((s) => (s === 'peek' ? 'peek' : 'compact'));
        else if (dy < 0) setState((s) => (s === 'peek' ? 'compact' : s));
        clearTimeout(idle);
        idle = setTimeout(() => !focused && setState('expanded'), 2000);
      });
    };
    const onPointer = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse') return;
      if (window.innerHeight - e.clientY < 120) setState('expanded');
    };
    const onFocusIn = () => {
      focused = true;
      setState('expanded');
    };
    const onFocusOut = (e: FocusEvent) => {
      if (!host?.contains(e.relatedTarget as Node)) focused = false;
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('pointermove', onPointer, { passive: true });
    host?.addEventListener('focusin', onFocusIn);
    host?.addEventListener('focusout', onFocusOut);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('pointermove', onPointer);
      host?.removeEventListener('focusin', onFocusIn);
      host?.removeEventListener('focusout', onFocusOut);
      clearTimeout(idle);
      cancelAnimationFrame(raf);
    };
  }, []);

  // --- keyboard shortcuts (§7.3, WCAG 2.1.4: can be turned off in the LOG drawer) ---
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || isTyping(e.target)) return;
      if (e.altKey && !e.ctrlKey && !e.metaKey && (e.code === 'KeyM' || e.code === 'KeyL')) {
        if (!shortcuts.value) return;
        e.preventDefault();
        if (e.code === 'KeyM') sysMotion();
        else sysLang();
        return;
      }
      if (e.ctrlKey || e.metaKey || e.altKey || e.shiftKey) return;
      if (e.key === 'Escape') {
        if (document.body.classList.contains('has-modal') || sheet || sysPop) {
          setSheet(false);
          setSysPop(false);
          return;
        }
        openLog();
        return;
      }
      if (!shortcuts.value) return;
      const n = Number(e.key);
      if (Number.isInteger(n) && n >= 1 && n <= 8) {
        const c = CHAPTERS[n - 1]!;
        if (c.href !== currentPath()) {
          e.preventDefault();
          go(c, 'key');
        }
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [sheet, sysPop]);

  function dismissHint() {
    if (hint) {
      setHint(false);
      write(KEYS.dockHint, true);
    }
  }
  function go(c: Chapter, via: 'click' | 'key' | 'talk') {
    track('dock_nav', { to: c.id, via });
    dismissHint();
    navigate(c.href);
  }
  function onChapterClick(e: MouseEvent, c: Chapter) {
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    track('dock_nav', { to: c.id, via: 'click' });
    dismissHint();
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
    toggleBgm();
    track('sys_toggle', { what: 'bgm', value: !bgmOn.value });
  }

  // roving focus for the system toolbar
  function onToolbarKey(e: KeyboardEvent) {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    const btns = Array.from((e.currentTarget as HTMLElement).querySelectorAll<HTMLButtonElement>('button'));
    const i = btns.indexOf(document.activeElement as HTMLButtonElement);
    const next = btns[(i + (e.key === 'ArrowRight' ? 1 : -1) + btns.length) % btns.length];
    next?.focus();
    e.preventDefault();
  }

  const L = lang.value;
  const sysButtons = (
    <>
      <button
        type="button"
        class="sysbtn"
        aria-pressed={bgmOn.value}
        onClick={sysBgm}
        aria-label={L === 'ja' ? 'BGM オン・オフ' : 'BGM on/off'}
      >
        <Icon name="music" />
        BGM
      </button>
      <button
        type="button"
        class="sysbtn"
        aria-pressed={motion.value === 'on'}
        onClick={sysMotion}
        aria-label={L === 'ja' ? 'モーション オン・オフ (Alt+M)' : 'Motion on/off (Alt+M)'}
      >
        <Icon name="anchor" />
        AUTO
      </button>
      <button
        type="button"
        class="sysbtn"
        onClick={sysLang}
        aria-label={L === 'ja' ? '言語を英語に切り替え (Alt+L)' : 'Switch language to Japanese (Alt+L)'}
      >
        <span class="glyph" aria-hidden="true">
          文A
        </span>
        JP/EN
      </button>
      <button
        type="button"
        class="sysbtn"
        onClick={() => openLog()}
        aria-label={L === 'ja' ? 'ログを開く (Esc)' : 'Open the log (Esc)'}
      >
        <Icon name="menu" />
        LOG
      </button>
    </>
  );

  const mobileIds =
    active && !MOBILE_SET.includes(active.id)
      ? MOBILE_SET.map((id) => (id === 'clips' ? active.id : id))
      : MOBILE_SET;

  return (
    <div class="dock-host" data-state={state} ref={hostRef}>
      {hint && (
        <span class="dock-hint sticker sticker--soft" role="status">
          {L === 'ja' ? 'チャプターをえらんでね ⚓' : 'Choose a chapter ⚓'}
        </span>
      )}
      <nav class="dock" aria-label={L === 'ja' ? 'チャプター' : 'Chapters'} onClick={dismissHint}>
        <span class={`dock__plate${typing ? ' is-typing' : ''}`} aria-hidden="true">
          {plate}
          <span class="caret" />
        </span>
        <ol class="dock__chapters" role="list">
          {CHAPTERS.map((c, i) => (
            <li class={mobileIds.includes(c.id) ? '' : 'is-extra'}>
              <a
                class="chap"
                href={c.href}
                data-astro-prefetch="hover"
                aria-current={active?.id === c.id ? 'page' : undefined}
                aria-keyshortcuts={String(i + 1)}
                onClick={(e) => onChapterClick(e as unknown as MouseEvent, c)}
              >
                <span class="chap__dot" style={`--dot:var(${c.tint})`} aria-hidden="true" />
                <b lang="ja">{c.ja}</b>
                <small lang="en">{c.en}</small>
                <span class="sr-only">
                  {' '}
                  {c.no} {c.title.en}
                </span>
                <span class="chap__tip" aria-hidden="true">
                  {c.ja} · {c.en}
                </span>
              </a>
            </li>
          ))}
          <li class="dock__more">
            <button
              type="button"
              class="chap"
              aria-expanded={sheet}
              aria-haspopup="dialog"
              onClick={() => setSheet(true)}
            >
              <span class="chap__dot" style="--dot:var(--lavender)" aria-hidden="true" />
              <b lang="ja">もっと</b>
              <small>MORE</small>
            </button>
          </li>
        </ol>
        <span class="dock__sep" aria-hidden="true" />
        <div
          class="dock__sys"
          role="toolbar"
          aria-label={L === 'ja' ? 'システム' : 'System'}
          onKeyDown={onToolbarKey}
        >
          {sysButtons}
        </div>
        <div style="position:relative;display:flex;align-items:center">
          <button
            type="button"
            class="sysbtn dock__gear"
            aria-expanded={sysPop}
            aria-label={L === 'ja' ? 'システム設定' : 'System settings'}
            onClick={() => setSysPop((v) => !v)}
          >
            <Icon name="gear" />
          </button>
          {sysPop && (
            <div class="sys-pop" role="group" aria-label={L === 'ja' ? 'システム' : 'System'}>
              {sysButtons}
            </div>
          )}
        </div>
      </nav>

      {sheet && (
        <>
          <div class="scrim" style="pointer-events:auto" onClick={() => setSheet(false)} />
          <div
            class="chapter-sheet"
            role="dialog"
            aria-modal="true"
            aria-label={L === 'ja' ? 'チャプターセレクト' : 'Chapter select'}
            style="pointer-events:auto"
          >
            <div style="display:flex;justify-content:space-between;align-items:center">
              <span class="ribbon">
                CHAPTER SELECT <small>チャプター</small>
              </span>
              <button
                type="button"
                class="btn btn--ghost btn--icon"
                aria-label={L === 'ja' ? '閉じる' : 'Close'}
                onClick={() => setSheet(false)}
                autoFocus
              >
                <Icon name="close" />
              </button>
            </div>
            <ol class="chapter-sheet__grid" role="list">
              {CHAPTERS.map((c) => (
                <li>
                  <a
                    class="swatch"
                    href={c.href}
                    style={`--dot:var(${c.tint})`}
                    aria-current={active?.id === c.id ? 'page' : undefined}
                    onClick={(e) => onChapterClick(e as unknown as MouseEvent, c)}
                  >
                    <small>{c.no}</small>
                    <b lang="ja">{c.title.ja}</b>
                    <small lang="en">{c.title.en.toUpperCase()}</small>
                  </a>
                </li>
              ))}
            </ol>
          </div>
        </>
      )}
    </div>
  );
}
