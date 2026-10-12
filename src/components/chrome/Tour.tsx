/**
 * First-visit onboarding: a ~15-second spotlight tour of Talk, the chapter dock, AUTO (motion), JP/EN,
 * LOG and HELP. Starts once the splash has gone; Esc / Skip ends it; finishing or skipping stores
 * KEYS.tourDone. HELP → "Replay the tour" clears that flag and reloads.
 */
import { useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks';
import { lang } from '../../lib/prefs';
import { KEYS, read, write } from '../../lib/storage';
import { track } from '../../lib/analytics';

type Step = {
  id: string;
  /** candidates, first visible one wins; none → a centred card */
  targets: string[];
  title: [string, string];
  body: [string, string];
  /** wording when the target isn't on this page */
  bodyAway?: [string, string];
  dock?: boolean;
};

const STEPS: Step[] = [
  {
    id: 'welcome',
    targets: [],
    title: ['ようこそ、あくあ色アーカイブへ ⚓', 'Welcome aboard ⚓'],
    body: ['15秒で、このアーカイブの使い方をご案内します。', 'A 15-second tour of how this archive works.'],
  },
  {
    id: 'talk',
    targets: ['.home-hero__dialog .dialog-box'],
    title: ['あくあとお話し', 'Talk with Aqua'],
    body: [
      'テキストボックスをクリック（または Enter）で、ノベルゲームのように会話が進みます。選択肢は 1–3 キーでも。',
      'Click the text box (or press Enter) to move the conversation on, like a visual novel. Choices work with 1–3 too.',
    ],
    bodyAway: [
      'ホームのテキストボックスをクリックすると、ノベルゲームのようにあくあと会話できます。',
      'On the Home page, click the text box to chat with Aqua, like a visual novel.',
    ],
  },
  {
    id: 'chapters',
    targets: ['.dock__chapters'],
    title: ['チャプター', 'Chapters'],
    body: [
      '下のドックから各章へ。数字キー 1–8 でも移動できます。',
      'Jump between chapters here, or press 1–8.',
    ],
    dock: true,
  },
  {
    id: 'motion',
    targets: ['.dock__sys [data-sys="motion"]', '.dock__gear'],
    title: ['アニメーション', 'Motion'],
    body: [
      'AUTO でアニメーションのオン・オフ（Alt+M）。いつでも切り替えられます。',
      'AUTO turns animation on or off (Alt+M), whenever you like.',
    ],
    dock: true,
  },
  {
    id: 'lang',
    targets: ['.dock__sys [data-sys="lang"]', '.dock__gear'],
    title: ['言語', 'Language'],
    body: ['日本語 ⇄ English をいつでも切り替え（Alt+L）。', 'Switch Japanese ⇄ English any time (Alt+L).'],
    dock: true,
  },
  {
    id: 'log',
    targets: ['.dock__sys [data-sys="log"]', '.dock__gear'],
    title: ['LOG', 'LOG'],
    body: [
      '会話のバックログ、思い出アルバム、クレジット、ショートカット（Esc）。',
      'Your conversation backlog, memory album, credits and shortcuts (Esc).',
    ],
    dock: true,
  },
  {
    id: 'help',
    targets: ['.dock__sys [data-sys="help"]', '.dock__gear'],
    title: ['HELP', 'HELP'],
    body: [
      '使い方の確認や、このツアーをもう一度見たいときはここから。',
      'A quick guide lives here, and you can replay this tour from it.',
    ],
    dock: true,
  },
];

const PAD = 8;
const visible = (el: Element) => {
  const r = el.getBoundingClientRect();
  return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== 'hidden';
};
const findTarget = (s: Step) =>
  s.targets.map((q) => document.querySelector(q)).find((el): el is HTMLElement => !!el && visible(el)) ??
  null;

export default function Tour() {
  const [i, setI] = useState<number | null>(null);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const [cardH, setCardH] = useState(0);
  const L = lang.value;
  const pick = (t: [string, string]) => (L === 'ja' ? t[0] : t[1]);

  // start after the splash is gone (or right away when it was already seen this session)
  useEffect(() => {
    if (read<boolean>(KEYS.tourDone, false)) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    // the splash fades out for 700 ms after it marks itself seen
    const begin = () => (timer = setTimeout(() => setI(0), 900));
    if (document.documentElement.dataset.splash === 'seen') begin();
    else window.addEventListener('aia:splash-seen', begin, { once: true });
    return () => {
      clearTimeout(timer);
      window.removeEventListener('aia:splash-seen', begin);
    };
  }, []);

  const step = i === null ? null : STEPS[i]!;

  // follow the target (it can move: dock expanding, page scroll, resize)
  useEffect(() => {
    if (!step) return;
    window.dispatchEvent(new CustomEvent('aia:dock-hold', { detail: true }));
    let raf = 0;
    const el = findTarget(step);
    if (el && !step.dock) el.scrollIntoView({ block: 'center', behavior: 'auto' });
    const measure = () => {
      const t = findTarget(step);
      setRect(t ? t.getBoundingClientRect() : null);
      raf = requestAnimationFrame(measure);
    };
    measure();
    return () => cancelAnimationFrame(raf);
  }, [i]);

  useLayoutEffect(() => {
    if (cardRef.current) setCardH(cardRef.current.offsetHeight);
    cardRef.current?.querySelector<HTMLElement>('[data-next]')?.focus({ preventScroll: true });
  }, [i, L]);

  // keyboard: Esc skips, ← / → move, Tab stays inside the card
  useEffect(() => {
    if (i === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Tab') {
        const btns = Array.from(cardRef.current?.querySelectorAll<HTMLElement>('button') ?? []);
        if (!btns.length) return;
        const at = btns.indexOf(document.activeElement as HTMLElement);
        const to = btns[(at + (e.shiftKey ? -1 : 1) + btns.length) % btns.length]!;
        e.preventDefault();
        to.focus();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        end(true);
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        next();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        back();
      }
    };
    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
  }, [i]);

  function end(skipped: boolean) {
    write(KEYS.tourDone, true);
    write(KEYS.dockHint, true);
    window.dispatchEvent(new Event('aia:hint-off'));
    window.dispatchEvent(new CustomEvent('aia:dock-hold', { detail: false }));
    track('tour', { done: skipped ? `skip@${STEPS[i ?? 0]!.id}` : 'finish' });
    setI(null);
  }
  function next() {
    if (i === null) return;
    if (i >= STEPS.length - 1) end(false);
    else setI(i + 1);
  }
  function back() {
    if (i) setI(i - 1);
  }

  if (!step) return null;

  const vw = typeof window === 'undefined' ? 1280 : window.innerWidth;
  const vh = typeof window === 'undefined' ? 800 : window.innerHeight;
  const cardW = Math.min(360, vw - 32);
  let cardStyle: string;
  let holeStyle = '';
  if (rect) {
    const hole = { x: rect.left - PAD, y: rect.top - PAD, w: rect.width + PAD * 2, h: rect.height + PAD * 2 };
    holeStyle = `left:${hole.x}px;top:${hole.y}px;width:${hole.w}px;height:${hole.h}px`;
    const below = hole.y + hole.h / 2 < vh / 2;
    const top = below ? hole.y + hole.h + 14 : hole.y - 14 - cardH;
    const left = Math.max(16, Math.min(vw - cardW - 16, hole.x + hole.w / 2 - cardW / 2));
    cardStyle = `width:${cardW}px;left:${left}px;top:${Math.max(12, Math.min(vh - cardH - 12, top))}px`;
  } else {
    cardStyle = `width:${cardW}px;left:${(vw - cardW) / 2}px;top:${Math.max(12, (vh - cardH) / 2)}px`;
  }
  const away = !rect && step.bodyAway;
  const last = i === STEPS.length - 1;

  return (
    <div
      class="tour"
      role="dialog"
      aria-modal="true"
      aria-labelledby="tour-title"
      aria-describedby="tour-body"
    >
      <div class="tour__blocker" />
      {rect ? <div class="tour__hole" style={holeStyle} /> : <div class="tour__dim" />}
      <div class="tour__card" style={cardStyle} ref={cardRef}>
        <p class="tour__count label">
          <b>
            {i! + 1} / {STEPS.length}
          </b>{' '}
          · {L === 'ja' ? 'はじめてガイド' : 'FIRST-VISIT GUIDE'}
        </p>
        <h2 id="tour-title">{pick(step.title)}</h2>
        <p id="tour-body">{pick(away ? step.bodyAway! : step.body)}</p>
        <div class="tour__dots" aria-hidden="true">
          {STEPS.map((_, n) => (
            <i class={n === i ? 'is-on' : ''} />
          ))}
        </div>
        <div class="tour__btns">
          <button type="button" class="btn btn--ghost" onClick={() => end(true)}>
            {L === 'ja' ? 'スキップ' : 'Skip'}
          </button>
          {i! > 0 && (
            <button type="button" class="btn btn--secondary" onClick={back}>
              {L === 'ja' ? '戻る' : 'Back'}
            </button>
          )}
          <button type="button" class="btn btn--primary" data-next onClick={next}>
            {last ? (L === 'ja' ? 'はじめる ⚓' : "Let's go ⚓") : L === 'ja' ? 'つぎへ' : 'Next'}
          </button>
        </div>
      </div>
    </div>
  );
}
