/**
 * HELP drawer: what each control does, plus "Replay the tour" (with a confirm step). Replaying reloads
 * the page so the splash and the onboarding tour run again; settings, the memory album and board
 * drafts are kept. Opened by the dock's HELP button (window event "aia:help").
 */
import { useEffect, useRef, useState } from 'preact/hooks';
import { KEYS, remove, write } from '../../lib/storage';
import { track } from '../../lib/analytics';
import { useLang } from '../../lib/useLang';

const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]),[tabindex]:not([tabindex="-1"])';

type Item = { icon: string; glyph?: string; name: string; ja: string; en: string };
const ITEMS: Item[] = [
  {
    icon: 'anchor',
    name: 'LOGO',
    ja: '左上のロゴから、いつでもホームに戻れます。',
    en: 'The logo in the top-left corner takes you home from anywhere.',
  },
  {
    icon: 'heart',
    name: 'TALK',
    ja: 'ホームのテキストボックスをクリック（または Enter）すると、ノベルゲームのように会話が進みます。選択肢はクリックか 1–3 キーで。',
    en: 'On Home, click the text box (or press Enter) to move the conversation on, like a visual novel. Pick a choice with a click or the 1–3 keys.',
  },
  {
    icon: '',
    glyph: '▸▸',
    name: 'SKIP · AUTO · LOG · ×',
    ja: '会話の文字送りを飛ばす・自動で進める・履歴を見る・会話をかくす。',
    en: 'In a conversation: finish the line, play it by itself, see what was said, or tuck the box away.',
  },
  {
    icon: 'headdress',
    name: 'OUTFITS',
    ja: 'ホームの「衣装」メニューで選べます。「ランダム」なら自動で切り替わり、選んだ衣装は次回もそのままです。',
    en: 'On Home, the Outfit menu picks what she wears. Random keeps changing; a picked outfit stays for next time.',
  },
  {
    icon: 'play',
    name: 'THREE MOMENTS',
    ja: 'ホームの3本の動画。その場で再生、または「BGMで流す」で曲を流しながら見て回れます。',
    en: 'Three key videos on Home: play one right there, or press Play as BGM to keep the song going.',
  },
  {
    icon: 'anchor',
    name: 'CHAPTERS',
    ja: '下のドックから各チャプターへ。数字キー 1–8 でも移動できます。',
    en: 'Jump between chapters from the dock at the bottom, or press 1–8.',
  },
  {
    icon: 'music',
    name: 'BGM',
    ja: '曲を流しながら見て回れます（自動再生はしません）。ページを移動しても止まらず、プレーヤーで曲送り・停止もできます。',
    en: 'Play her songs while you browse (never on its own). It keeps going between pages; the little player can skip or stop.',
  },
  {
    icon: 'anchor',
    name: 'AUTO',
    ja: 'アニメーションのオン・オフ（Alt+M）。',
    en: 'Turns animation on or off (Alt+M).',
  },
  {
    icon: '',
    glyph: '文A',
    name: 'JP/EN',
    ja: '日本語 ⇄ English の切り替え（Alt+L）。',
    en: 'Switches Japanese ⇄ English (Alt+L).',
  },
  {
    icon: 'menu',
    name: 'LOG',
    ja: '会話のバックログ、思い出アルバム、クレジット、ショートカット（Esc）。',
    en: 'Your conversation backlog, memory album, credits and shortcuts (Esc).',
  },
];

export default function HelpDrawer({ makerLogo, makerUrl }: { makerLogo: string; makerUrl: string }) {
  const [open, setOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const ref = useRef<HTMLElement>(null);
  const returnTo = useRef<HTMLElement | null>(null);
  const L = useLang();
  const say = (ja: string, en: string) => (L === 'ja' ? ja : en);

  useEffect(() => {
    const onHelp = (e: Event) => {
      const d = (e as CustomEvent<{ toggle?: boolean; open?: boolean }>).detail ?? {};
      setOpen((v) => (d.open !== undefined ? d.open : d.toggle ? !v : true));
    };
    const close = () => setOpen(false);
    // one drawer at a time: the LOG opening closes HELP
    const onLog = (e: Event) => (e as CustomEvent<{ open?: boolean }>).detail?.open !== false && close();
    window.addEventListener('aia:help', onHelp);
    window.addEventListener('aia:log', onLog);
    document.addEventListener('astro:before-swap', close);
    return () => {
      window.removeEventListener('aia:help', onHelp);
      window.removeEventListener('aia:log', onLog);
      document.removeEventListener('astro:before-swap', close);
    };
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (!open) {
      setConfirming(false);
      if (!document.querySelector('.drawer.is-open')) document.body.classList.remove('has-drawer');
      returnTo.current?.focus?.();
      returnTo.current = null;
      return;
    }
    returnTo.current = document.activeElement as HTMLElement;
    document.body.classList.add('has-drawer');
    track('help_open');
    requestAnimationFrame(() => el.querySelector<HTMLElement>('.drawer__head button')?.focus());
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        setOpen(false);
        return;
      }
      if (e.key !== 'Tab') return;
      const f = Array.from(el.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (x) => x.offsetParent !== null,
      );
      if (!f.length) return;
      const first = f[0]!;
      const last = f[f.length - 1]!;
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
  }, [open]);

  useEffect(() => {
    if (confirming) ref.current?.querySelector<HTMLElement>('[data-replay-yes]')?.focus();
  }, [confirming]);

  function replay() {
    track('tour_replay');
    remove(KEYS.tourDone);
    write(KEYS.replay, 1, 'session');
    location.reload();
  }

  return (
    <>
      {open && <div class="scrim" onClick={() => setOpen(false)} />}
      <aside
        ref={ref}
        class={`drawer drawer--help${open ? ' is-open' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="help-title"
        aria-hidden={!open}
        inert={!open}
      >
        <div class="drawer__head">
          <h2 id="help-title">
            <span lang="en">HELP</span>{' '}
            <span class="label" lang="ja">
              つかいかた
            </span>
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

        <div class="drawer__panel" tabIndex={0}>
          <ul class="help-list" role="list">
            {ITEMS.map((it) => (
              <li>
                <span class="help-list__key" aria-hidden="true">
                  {it.glyph ? (
                    <span class="glyph">{it.glyph}</span>
                  ) : (
                    <svg class="icon">
                      <use href={`#i-${it.icon}`} />
                    </svg>
                  )}
                </span>
                <div>
                  <b>{it.name}</b>
                  <p>{say(it.ja, it.en)}</p>
                </div>
              </li>
            ))}
          </ul>

          <div class="help-replay">
            {!confirming ? (
              <>
                <p>
                  {say(
                    '最初のツアーをもう一度見たいときはこちら。',
                    'Want the first-visit tour again? Replay it here.',
                  )}
                </p>
                <button type="button" class="btn btn--primary" onClick={() => setConfirming(true)}>
                  <svg class="icon" aria-hidden="true">
                    <use href="#i-play" />
                  </svg>{' '}
                  {say('ツアーをもう一度', 'Replay the tour')}
                </button>
              </>
            ) : (
              <div role="alertdialog" aria-labelledby="replay-q" aria-describedby="replay-d">
                <p id="replay-q">
                  <b>{say('ツアーをもう一度表示しますか？', 'Replay the tour?')}</b>
                </p>
                <p id="replay-d" class="muted">
                  {say(
                    'ページを再読み込みして、読み込み画面とツアーを表示します。設定や思い出アルバムはそのまま残ります。',
                    'The page reloads, then the loading screen and the tour play again. Your settings and memory album stay as they are.',
                  )}
                </p>
                <div class="help-replay__btns">
                  <button type="button" class="btn btn--secondary" onClick={() => setConfirming(false)}>
                    {say('キャンセル', 'Cancel')}
                  </button>
                  <button type="button" class="btn btn--primary" data-replay-yes onClick={replay}>
                    {say('再生する', 'Yes, replay')}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        <a class="drawer__maker" href={makerUrl} rel="noopener" target="_blank">
          <small>{say('制作', 'Made by')}</small>
          <img src={makerLogo} alt="Moesoft" width={120} height={36} loading="lazy" />
          <span>{say('ほかの作品 ↗', 'More work ↗')}</span>
        </a>
      </aside>
    </>
  );
}
