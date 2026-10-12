/**
 * LOG drawer (EXECUTIONPLAN §7.4): Backlog · Memory album · Credits & sources · Shortcuts.
 * Opened by the dock's ☰ LOG button, Esc, or the dialogue box (window event "aia:log").
 */
import { useEffect, useRef, useState } from 'preact/hooks';
import { lang, shortcuts, setShortcuts } from '../../lib/prefs';
import { backlog, album, loadScript } from '../../lib/talk/store';
import { track } from '../../lib/analytics';
import type { Conversation } from '../../lib/talk/types';

type Tab = 'backlog' | 'album' | 'credits' | 'shortcuts';
const TABS: { id: Tab; ja: string; en: string }[] = [
  { id: 'backlog', ja: 'バックログ', en: 'Backlog' },
  { id: 'album', ja: '思い出アルバム', en: 'Memory album' },
  { id: 'credits', ja: 'クレジット', en: 'Credits' },
  { id: 'shortcuts', ja: 'ショートカット', en: 'Shortcuts' },
];
const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]),[tabindex]:not([tabindex="-1"])';

export default function LogDrawer() {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<Tab>('backlog');
  const [convs, setConvs] = useState<Conversation[] | null>(null);
  const ref = useRef<HTMLElement>(null);
  const returnTo = useRef<HTMLElement | null>(null);
  const L = lang.value;
  const say = (ja: string, en: string) => (L === 'ja' ? ja : en);

  useEffect(() => {
    const onLog = (e: Event) => {
      const d = (e as CustomEvent<{ toggle?: boolean; open?: boolean; tab?: Tab }>).detail ?? {};
      if (d.tab) setTab(d.tab);
      setOpen((v) => (d.open !== undefined ? d.open : d.toggle ? !v : true));
    };
    const onNav = () => setOpen(false);
    window.addEventListener('aia:log', onLog);
    document.addEventListener('astro:before-swap', onNav);
    return () => {
      window.removeEventListener('aia:log', onLog);
      document.removeEventListener('astro:before-swap', onNav);
    };
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open) {
      returnTo.current = document.activeElement as HTMLElement;
      document.body.classList.add('has-drawer');
      track('log_open', { tab });
      requestAnimationFrame(() =>
        el.querySelector<HTMLElement>('[role="tab"][aria-selected="true"]')?.focus(),
      );
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
    } else {
      document.body.classList.remove('has-drawer');
      returnTo.current?.focus?.();
      returnTo.current = null;
    }
  }, [open]);

  useEffect(() => {
    if (!open || tab !== 'album' || convs) return;
    loadScript()
      .then((s) => {
        setConvs(s.conversations);
        const found = s.conversations.filter((c) => album.value[c.id]).length;
        track('album_open', { found, total: s.conversations.length });
      })
      .catch(() => setConvs([]));
  }, [open, tab]);

  function onTabKey(e: KeyboardEvent) {
    const i = TABS.findIndex((t) => t.id === tab);
    let n = i;
    if (e.key === 'ArrowRight') n = (i + 1) % TABS.length;
    else if (e.key === 'ArrowLeft') n = (i - 1 + TABS.length) % TABS.length;
    else return;
    e.preventDefault();
    setTab(TABS[n]!.id);
    requestAnimationFrame(() => ref.current?.querySelector<HTMLElement>(`#log-tab-${TABS[n]!.id}`)?.focus());
  }

  const foundCount = convs ? convs.filter((c) => album.value[c.id]).length : 0;

  return (
    <>
      {open && <div class="scrim" onClick={() => setOpen(false)} />}
      <aside
        ref={ref}
        class={`drawer${open ? ' is-open' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="log-title"
        aria-hidden={!open}
        inert={!open}
      >
        <div class="drawer__head">
          <h2 id="log-title">
            <span lang="en">LOG</span>{' '}
            <span class="label" lang="ja">
              ログ
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
        <div class="drawer__tabs" role="tablist" aria-label="LOG" onKeyDown={onTabKey}>
          {TABS.map((t) => (
            <button
              type="button"
              role="tab"
              id={`log-tab-${t.id}`}
              aria-controls={`log-panel-${t.id}`}
              aria-selected={tab === t.id}
              tabIndex={tab === t.id ? 0 : -1}
              onClick={() => setTab(t.id)}
            >
              {say(t.ja, t.en)}
            </button>
          ))}
        </div>

        <div
          class="drawer__panel"
          role="tabpanel"
          id={`log-panel-${tab}`}
          aria-labelledby={`log-tab-${tab}`}
          tabIndex={0}
        >
          {tab === 'backlog' &&
            (backlog.value.length ? (
              <ol class="backlog" role="list">
                {backlog.value.map((l) => (
                  <li>
                    <span class={`who${l.who === 'you' ? ' you' : ''}`}>
                      {l.who === 'you' ? say('あなた', 'YOU') : say('あくあ', 'AQUA')}
                    </span>
                    <p lang={L === 'ja' ? (l.ja ? 'ja' : 'en') : l.en ? 'en' : 'ja'}>
                      {L === 'ja' ? (l.ja ?? l.en) : (l.en ?? l.ja)}
                    </p>
                  </li>
                ))}
              </ol>
            ) : (
              <p class="muted">
                {say(
                  'まだ会話はありません。ホームのあくあに話しかけてみてね。',
                  'Nothing here yet. Say hi to Aqua on the Home page.',
                )}
              </p>
            ))}

          {tab === 'album' && (
            <>
              <p class="label" style="margin-bottom:10px">
                {convs
                  ? say(`${foundCount} / ${convs.length} 見つけた`, `${foundCount} / ${convs.length} found`)
                  : '…'}
              </p>
              {convs && (
                <ol class="album" role="list">
                  {convs.map((c) => {
                    const found = !!album.value[c.id];
                    return (
                      <li class={found ? '' : 'is-locked'}>
                        <span>
                          {found ? say(c.title.ja, c.title.en) : '？？？'}
                          {c.rare && <span aria-label={say('レア', 'rare')}> ✦</span>}
                        </span>
                        {found && (
                          <span class="credit">{album.value[c.id]!.slice(0, 10).replace(/-/g, '.')}</span>
                        )}
                      </li>
                    );
                  })}
                </ol>
              )}
            </>
          )}

          {tab === 'credits' && (
            <div style="display:grid;gap:12px">
              <p>
                {say(
                  '公式アートはすべてCOVER株式会社と各イラストレーターに帰属します。各作品に作者と出典を記載しています。音楽は公式YouTubeの埋め込みのみで、音声ファイルは置いていません。',
                  'All official art belongs to COVER Corp. and the credited artists; every piece shows its artist and source. Music is embedded from official YouTube uploads only — no audio is hosted here.',
                )}
              </p>
              <p>
                {say(
                  'データ出典：湊あくあ公式YouTube（2026年10月11日取得）、Virtual YouTuber Wiki、Hololive Fan Wiki、ホロ曲DB、Wikipedia。',
                  'Data sources: her official YouTube channel (crawled 2026-10-11), Virtual YouTuber Wiki, Hololive Fan Wiki, ホロ曲DB and Wikipedia.',
                )}
              </p>
              <a class="tag-link" href="/credits">
                <svg class="icon" aria-hidden="true">
                  <use href="#i-anchor" />
                </svg>
                {say('クレジットとポリシーへ', 'Go to Credits & Policy')}
              </a>
            </div>
          )}

          {tab === 'shortcuts' && (
            <div style="display:grid;gap:14px">
              <label class="switch">
                <input
                  type="checkbox"
                  checked={shortcuts.value}
                  onChange={(e) => setShortcuts((e.target as HTMLInputElement).checked)}
                />
                {say('キーボードショートカットを使う', 'Use keyboard shortcuts')}
              </label>
              <dl style="display:grid;grid-template-columns:auto 1fr;gap:8px 14px;align-items:center">
                <dt>
                  <span class="kbd">1</span>–<span class="kbd">8</span>
                </dt>
                <dd>{say('チャプターへ移動', 'Jump to a chapter')}</dd>
                <dt>
                  <span class="kbd">Esc</span>
                </dt>
                <dd>{say('ログを開く・閉じる', 'Open or close this log')}</dd>
                <dt>
                  <span class="kbd">Alt</span>+<span class="kbd">M</span>
                </dt>
                <dd>{say('モーション オン・オフ', 'Motion on / off')}</dd>
                <dt>
                  <span class="kbd">Alt</span>+<span class="kbd">L</span>
                </dt>
                <dd>{say('日本語 ⇄ English', 'Japanese ⇄ English')}</dd>
                <dt>
                  <span class="kbd">Enter</span> / <span class="kbd">Space</span>
                </dt>
                <dd>{say('会話を進める（ホーム）', 'Advance the dialogue (Home)')}</dd>
                <dt>
                  <span class="kbd">1</span>–<span class="kbd">3</span>
                </dt>
                <dd>{say('選択肢をえらぶ（会話中）', 'Pick a choice (during a conversation)')}</dd>
              </dl>
            </div>
          )}
        </div>

        <p class="drawer__foot">
          {say(
            'セリフはこのアーカイブのためのファン創作で、本人の言葉ではありません。',
            'Lines are fan-written for this archive, not her actual words.',
          )}{' '}
          · {say('非公式・非営利のファンサイトです。', 'Unofficial non-profit fan site.')}
        </p>
      </aside>
    </>
  );
}
