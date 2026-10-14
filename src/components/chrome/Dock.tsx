/**
 * Bottom VN dock (EXECUTIONPLAN §7.3). Persisted across ClientRouter navigations.
 * Two states, one rule: expanded at the top of the page and whenever you scroll up; compact while you
 * scroll down. The pointer on the dock or keyboard focus inside it keeps it expanded. The size change
 * animates the dock's width from the old size to the new one (contents never reflow mid-animation).
 */
import { useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks';
import { navigate } from 'astro:transitions/client';
import { CHAPTERS, chapterForPath, type Chapter } from '../../lib/chapters';
import { motion, lang, bgmOn, shortcuts, toggleMotion, toggleLang } from '../../lib/prefs';
import { track } from '../../lib/analytics';
import { timeDate } from '../../lib/aquatime';
import { useLang } from '../../lib/useLang';

type DockState = 'expanded' | 'compact';
const TOP = 80; // px: within this of the top the dock is always expanded
const SWITCH = 24; // px of travel in one direction before the state flips (no jitter on small wobbles)
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
function openTime() {
  window.dispatchEvent(new CustomEvent('aia:time-open', { detail: { toggle: true } }));
}
function openHelp() {
  window.dispatchEvent(new CustomEvent('aia:help', { detail: { toggle: true } }));
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

  // --- chapter change: the new chapter's dot sends up a short trail of bubbles ---
  useEffect(() => {
    if (motion.value !== 'on') return;
    const dot = hostRef.current?.querySelector<HTMLElement>('.chap[aria-current="page"] .chap__dot');
    if (!dot) return;
    const r = dot.getBoundingClientRect();
    const made: HTMLElement[] = [];
    for (let i = 0; i < 3; i++) {
      const b = document.createElement('i');
      b.className = 'dock-bubble';
      b.style.left = `${r.left + r.width / 2}px`;
      b.style.top = `${r.top}px`;
      document.body.append(b);
      made.push(b);
      b.animate(
        [
          { transform: 'translate(-50%, 0) scale(0.4)', opacity: 0.9 },
          { transform: `translate(calc(-50% + ${(i - 1) * 10}px), -${46 + i * 16}px) scale(1)`, opacity: 0 },
        ],
        {
          duration: 900 + i * 160,
          delay: i * 120,
          easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
          fill: 'backwards',
        },
      ).onfinish = () => b.remove();
    }
    return () => made.forEach((b) => b.remove());
  }, [path]);

  // --- scroll-driven state ---
  useEffect(() => {
    let lastY = window.scrollY;
    let travel = 0; // signed distance scrolled in the current direction
    let focused = false; // keyboard focus only — a mouse click leaves focus on the button it pressed
    let hovered = false;
    let held = false; // the onboarding tour keeps the dock open while it points at its buttons
    let raf = 0;
    const host = hostRef.current;
    const pinned = () => focused || hovered || held;
    const update = () => {
      raf = 0;
      const y = window.scrollY;
      const dy = y - lastY;
      lastY = y;
      travel = Math.sign(dy) === Math.sign(travel) ? travel + dy : dy;
      if (y < TOP || pinned() || travel < -SWITCH) setState('expanded');
      else if (travel > SWITCH) setState('compact');
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };
    // a new page (or Back/Forward) starts expanded, measured from where it lands
    const onArrive = () => {
      lastY = window.scrollY;
      travel = 0;
      setState('expanded');
    };
    const onHold = (e: Event) => {
      held = !!(e as CustomEvent<boolean>).detail;
      if (held) setState('expanded');
    };
    const onEnter = () => {
      hovered = true;
      setState('expanded');
    };
    const onLeave = () => (hovered = false);
    const onFocusIn = (e: FocusEvent) => {
      if (!(e.target as HTMLElement).matches?.(':focus-visible')) return;
      focused = true;
      setState('expanded');
    };
    const onFocusOut = (e: FocusEvent) => {
      if (!host?.contains(e.relatedTarget as Node)) focused = false;
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('aia:dock-hold', onHold);
    document.addEventListener('astro:page-load', onArrive);
    host?.addEventListener('pointerenter', onEnter);
    host?.addEventListener('pointerleave', onLeave);
    host?.addEventListener('focusin', onFocusIn);
    host?.addEventListener('focusout', onFocusOut);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('aia:dock-hold', onHold);
      document.removeEventListener('astro:page-load', onArrive);
      host?.removeEventListener('pointerenter', onEnter);
      host?.removeEventListener('pointerleave', onLeave);
      host?.removeEventListener('focusin', onFocusIn);
      host?.removeEventListener('focusout', onFocusOut);
      cancelAnimationFrame(raf);
    };
  }, []);

  // --- size change: animate the dock's width from the old size to the new one ---
  const lastWidth = useRef(0);
  useLayoutEffect(() => {
    const dock = hostRef.current?.querySelector<HTMLElement>('.dock');
    if (!dock) return;
    const to = dock.getBoundingClientRect().width;
    const from = lastWidth.current;
    lastWidth.current = to;
    if (!from || Math.abs(from - to) < 2 || motion.value !== 'on') return;
    // the outline animates its width in both directions; while it does, the contents are clipped
    // sideways only (the plate above and the shadow stay visible), so nothing reflows or squashes
    dock.classList.add('is-resizing');
    const anim = dock.animate([{ width: `${from}px` }, { width: `${to}px` }], {
      duration: 300,
      easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
    });
    anim.onfinish = anim.oncancel = () => dock.classList.remove('is-resizing');
  }, [state]);
  useEffect(() => {
    // keep the remembered width current when the content changes for other reasons (route, language)
    const dock = hostRef.current?.querySelector<HTMLElement>('.dock');
    if (!dock) return;
    const ro = new ResizeObserver(() => {
      if (!dock.getAnimations().length) lastWidth.current = dock.getBoundingClientRect().width;
    });
    ro.observe(dock);
    return () => ro.disconnect();
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

  function go(c: Chapter, via: 'click' | 'key' | 'talk') {
    track('dock_nav', { to: c.id, via });
    navigate(c.href);
  }
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

  const L = useLang();
  const sysButtons = (
    <>
      <button
        type="button"
        class="sysbtn"
        data-sys="bgm"
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
        data-sys="motion"
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
        data-sys="lang"
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
        data-sys="log"
        onClick={() => openLog()}
        aria-label={L === 'ja' ? 'ログを開く (Esc)' : 'Open the log (Esc)'}
      >
        <Icon name="menu" />
        LOG
      </button>
      <button
        type="button"
        class={`sysbtn${timeDate.value ? ' is-time' : ''}`}
        data-sys="time"
        aria-pressed={!!timeDate.value}
        onClick={() => openTime()}
        aria-label={L === 'ja' ? 'あくあ時間（日付を旅する）' : 'Aqua Time — travel to a date'}
      >
        <Icon name="tape" />
        TIME
      </button>
      <button
        type="button"
        class="sysbtn"
        data-sys="help"
        onClick={() => openHelp()}
        aria-label={L === 'ja' ? 'ヘルプ・使い方' : 'Help and how-to'}
      >
        <Icon name="help" />
        HELP
      </button>
    </>
  );

  const mobileIds =
    active && !MOBILE_SET.includes(active.id)
      ? MOBILE_SET.map((id) => (id === 'clips' ? active.id : id))
      : MOBILE_SET;

  return (
    <div class="dock-host" data-state={state} ref={hostRef}>
      <nav class="dock" aria-label={L === 'ja' ? 'チャプター' : 'Chapters'}>
        <span class="dock__progress" aria-hidden="true" />
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
                <small lang="en" data-short={c.id === 'messages' ? 'BOARD' : undefined}>
                  {c.en}
                </small>
                <span class="sr-only">
                  {' '}
                  {c.no} {c.title.en}
                </span>
                <span class="chap__tip" aria-hidden="true">
                  {L === 'ja' ? c.ja : c.en}
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
