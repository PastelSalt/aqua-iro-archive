/**
 * First-visit onboarding: a ~30-second spotlight tour of the logo, Talk and its buttons, the outfit dots,
 * Three Moments, the chapter dock, BGM, AUTO (motion), JP/EN, LOG and HELP (Home-only steps drop out elsewhere). Starts once the splash has gone; Esc / Skip ends it; finishing or skipping stores
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
  /** only part of the tour when its target is on the current page (Home-only controls) */
  homeOnly?: boolean;
  dock?: boolean;
};

const STEPS: Step[] = [
  {
    id: 'welcome',
    targets: [],
    title: ['ようこそ、あくあ色アーカイブへ ⚓', 'Welcome aboard ⚓'],
    body: [
      '30秒で、このアーカイブの使い方をご案内します。→ キーでも進めます。',
      'A 30-second tour of how this archive works. The → key moves it along too.',
    ],
  },
  {
    id: 'logo',
    targets: ['[data-logo-tab]'],
    title: ['ホームへ戻る', 'Back to Home'],
    body: [
      '左上のロゴから、いつでもホームに戻れます。',
      'The logo in the corner takes you home from anywhere.',
    ],
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
    id: 'talk-controls',
    targets: ['.home-hero__dialog .dialog-box__ctrls'],
    title: ['会話のボタン', 'Conversation buttons'],
    body: [
      'SKIP で文字送りを飛ばし、AUTO で自動で進みます。LOG は会話の履歴、× で会話をかくせます。',
      'SKIP finishes the line, AUTO plays the conversation by itself, LOG shows what was said, and × tucks the box away.',
    ],
    homeOnly: true,
  },
  {
    id: 'outfits',
    targets: ['.hero-outfit'],
    title: ['衣装を選ぶ', 'Choose her outfit'],
    body: [
      'このメニューで衣装を選べます。「ランダム」なら自動で切り替わり、選んだ衣装は次に来たときもそのままです。',
      'Pick her outfit from this menu. Random keeps them changing on their own; a picked outfit stays for next time.',
    ],
    homeOnly: true,
  },
  {
    id: 'moments',
    targets: ['.home-hero__reel'],
    title: ['思い出の3本', 'Three moments'],
    body: [
      'クリックでその場で再生。「BGMで流す」を押すと、曲を流しながらサイトを見て回れます。',
      'Click one to play it right here, or press Play as BGM to keep the song going while you browse.',
    ],
    homeOnly: true,
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
    id: 'bgm',
    targets: ['.dock__sys [data-sys="bgm"]', '.dock__gear'],
    title: ['BGM', 'BGM'],
    body: [
      'あくあの曲を流しながら見て回れます（自動では流れません）。ページを移動しても止まらず、プレーヤーで曲送り・停止もできます。',
      'Plays her songs while you browse (never on its own). Music keeps going between pages, and the little player can skip or stop.',
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
      '会話のバックログ、見つけた会話の思い出アルバム、クレジット、ショートカット（Esc）。',
      'Your conversation backlog, the memory album of talks you have found, credits and shortcuts (Esc).',
    ],
    dock: true,
  },
  {
    id: 'help',
    targets: ['.dock__sys [data-sys="help"]', '.dock__gear'],
    title: ['HELP', 'HELP'],
    body: [
      '使い方の確認や、このツアーをもう一度見たいときはここから。それでは、いってらっしゃいませ！',
      'A quick guide lives here, and you can replay this tour from it. Enjoy the voyage!',
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
  const [steps, setSteps] = useState<Step[]>(STEPS);
  const L = lang.value;
  const pick = (t: [string, string]) => (L === 'ja' ? t[0] : t[1]);

  // start after the splash is gone (or right away when it was already seen this session)
  useEffect(() => {
    if (read<boolean>(KEYS.tourDone, false)) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    // the splash fades out for 700 ms after it marks itself seen
    const begin = () =>
      (timer = setTimeout(() => {
        setSteps(STEPS.filter((st) => !st.homeOnly || findTarget(st)));
        setI(0);
      }, 900));
    if (document.documentElement.dataset.splash === 'seen') begin();
    else window.addEventListener('aia:splash-seen', begin, { once: true });
    return () => {
      clearTimeout(timer);
      window.removeEventListener('aia:splash-seen', begin);
    };
  }, []);

  const step = i === null ? null : (steps[i] ?? null);

  // follow the target (it can move: dock expanding, page scroll, resize)
  useEffect(() => {
    if (!step) return;
    window.dispatchEvent(new CustomEvent('aia:dock-hold', { detail: true }));
    let raf = 0;
    const el = findTarget(step);
    // only scroll when the target isn't already fully on screen above the dock
    if (el && !step.dock) {
      const r = el.getBoundingClientRect();
      if (r.top < 8 || r.bottom > window.innerHeight - 110)
        el.scrollIntoView({ block: 'center', behavior: 'auto' });
    }
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
    track('tour', { done: skipped ? `skip@${steps[i ?? 0]?.id}` : 'finish' });
    setI(null);
  }
  function next() {
    if (i === null) return;
    if (i >= steps.length - 1) end(false);
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
  const last = i === steps.length - 1;

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
            {i! + 1} / {steps.length}
          </b>{' '}
          · {L === 'ja' ? 'はじめてガイド' : 'FIRST-VISIT GUIDE'}
        </p>
        <h2 id="tour-title">{pick(step.title)}</h2>
        <p id="tour-body">{pick(away ? step.bodyAway! : step.body)}</p>
        <div class="tour__dots" aria-hidden="true">
          {steps.map((_, n) => (
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
