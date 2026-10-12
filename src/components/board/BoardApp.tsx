/**
 * No.07 Message Board island (EXECUTIONPLAN §9.7): composer + crew board + report popover.
 * Notes are always rendered as escaped text (Preact text nodes) — never as HTML.
 */
import { useEffect, useRef, useState } from 'preact/hooks';
import { actions } from 'astro:actions';
import { lang, motion } from '../../lib/prefs';
import { KEYS, read, write } from '../../lib/storage';
import { track } from '../../lib/analytics';
import { checkText, graphemeCount, LIMITS } from '../../lib/text/normalize';
import { jstDate } from '../../lib/format';
import { mountTurnstile, type Widget } from './turnstile';

type Note = {
  id: string;
  crewNo: number;
  status: 'visible' | 'under_review' | 'held';
  body: string | null;
  createdAt: string;
  mine?: boolean;
  pending?: boolean;
};
type Mine = {
  id: string;
  crewNo: number;
  undoToken: string;
  undoUntil: string;
  status: 'visible' | 'held';
  body: string;
  createdAt: string;
};
type Sort = 'new' | 'random';

const PAPERS = [
  'var(--note-pink)',
  'var(--note-mint)',
  'var(--note-cream)',
  'var(--note-lav)',
  'var(--note-sky)',
];
const TILTS = [-1.6, 1.2, -0.6, 2];
const HOLDERS = ['tape', 'tape--blue', 'tape--mint', 'pin'] as const;
const REASONS = [
  { id: 'spam', ja: 'スパム・宣伝', en: 'Spam or advertising' },
  { id: 'hate', ja: '誹謗中傷・嫌がらせ', en: 'Hateful or harassing' },
  { id: 'sexual', ja: '性的・不適切な内容', en: 'Sexual or inappropriate' },
  { id: 'personal_info', ja: '個人情報', en: 'Shares personal info' },
  { id: 'impersonation', ja: 'なりすまし', en: 'Impersonation' },
  { id: 'other', ja: 'その他', en: 'Off-topic / other' },
] as const;
const ERRORS: Record<string, { ja: string; en: string }> = {
  RATE: {
    ja: 'たくさん貼ってくれてありがとう！少し休んでから、また来てね。',
    en: "You've pinned a lot today! Please rest a bit and come back later.",
  },
  BOT: {
    ja: 'ボットではないことを確認できませんでした。もう一度お試しください。',
    en: "We couldn't confirm you're not a bot — try again.",
  },
  FILTER: {
    ja: 'ボードに貼れない言葉が含まれています。やさしい言葉で書き直してね。',
    en: "This note has words the board can't accept. Please rephrase kindly.",
  },
  LINK: { ja: 'リンクは貼れません。', en: 'Links can’t be pinned.' },
  PERSONAL: {
    ja: '個人情報（メール・ID・電話番号）は書かないでね。',
    en: 'Please leave out personal info (emails, handles, phone numbers).',
  },
  LENGTH: { ja: '300文字までです。', en: 'Notes can be up to 300 characters.' },
  EMPTY: { ja: 'メッセージを書いてね。', en: 'Write a message first.' },
  EMOJI: { ja: '絵文字は20個までです。', en: 'Up to 20 emoji, please.' },
  DUPLICATE: { ja: '同じ寄せ書きがもう貼られています。', en: 'That note is already on the board.' },
  PAUSED: {
    ja: 'ボードは今日はお休みです。また来てね ⚓',
    en: 'The board is resting today. Please come back soon ⚓',
  },
  NETWORK: {
    ja: '送信できませんでした。下書きは残してあります。',
    en: "Couldn't send it. Your draft is saved.",
  },
  INTERNAL: {
    ja: 'エラーが起きました。少し待ってからもう一度どうぞ。',
    en: 'Something went wrong. Please try again in a moment.',
  },
};

const style = (n: number) => ({ paper: PAPERS[n % 5]!, tilt: TILTS[n % 4]!, holder: HOLDERS[n % 4]! });
const pickL = (o: { ja: string; en: string }) => (lang.value === 'ja' ? o.ja : o.en);

function readMine(): Mine[] {
  return read<Mine[]>(KEYS.boardMine, []).slice(-20);
}

export default function BoardApp({ siteKey }: { siteKey: string }) {
  const L = lang.value;
  const say = (ja: string, en: string) => (L === 'ja' ? ja : en);

  // ---------- board state ----------
  const [sort, setSort] = useState<Sort>(() => read<Sort>(KEYS.boardSort, 'new'));
  const [notes, setNotes] = useState<Note[]>([]);
  const [cursor, setCursor] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [total, setTotal] = useState<number | null>(null);
  const [nextNo, setNextNo] = useState<number | null>(null);
  const [paused, setPaused] = useState(false);
  const [seed] = useState(() => 1 + Math.floor(Math.random() * 50));
  const [mine, setMine] = useState<Mine[]>([]);
  const [reported, setReported] = useState<string[]>([]);
  const [reporting, setReporting] = useState<string | null>(null);
  const sentinel = useRef<HTMLDivElement>(null);

  // ---------- composer state ----------
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const ts = useRef<Widget | null>(null);
  const tsEl = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMine(readMine());
    setReported(read<string[]>(KEYS.boardReported, []));
    setDraft(read<string>(KEYS.boardDraft, ''));
    if (siteKey && tsEl.current)
      mountTurnstile(tsEl.current, siteKey, lang.value)
        .then((w) => (ts.current = w))
        .catch(() => undefined);
    return () => ts.current?.destroy();
  }, []);

  async function load(reset: boolean) {
    setLoading(true);
    setFailed(false);
    const c = reset ? null : cursor;
    try {
      const qs = new URLSearchParams({
        sort,
        limit: '30',
        ...(sort === 'random' ? { seed: String(seed) } : {}),
        ...(c != null ? { cursor: String(c) } : {}),
      });
      const res = await fetch(`/api/messages?${qs}`, { credentials: 'omit' });
      if (!res.ok) throw new Error(String(res.status));
      const data = (await res.json()) as {
        items: Note[];
        nextCursor: number | null;
        total: number;
        nextCrewNo: number;
      };
      setNotes((prev) => {
        const base = reset ? [] : prev;
        const seen = new Set(base.map((n) => n.id));
        return [...base, ...data.items.filter((n) => !seen.has(n.id))];
      });
      setCursor(data.nextCursor);
      setTotal(data.total);
      setNextNo(data.nextCrewNo);
      if (!reset) track('board_more', { page: String(c ?? 0) });
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    void load(true);
    fetch('/api/messages/count', { credentials: 'omit' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { paused?: boolean } | null) => d && setPaused(!!d.paused))
      .catch(() => undefined);
  }, [sort]);

  // auto-load more (Motion ON only; the button always works)
  useEffect(() => {
    const el = sentinel.current;
    if (!el || motion.value !== 'on' || cursor == null) return;
    const io = new IntersectionObserver((e) => e[0]?.isIntersecting && !loading && void load(false), {
      rootMargin: '400px',
    });
    io.observe(el);
    return () => io.disconnect();
  }, [cursor, loading, motion.value]);

  function changeSort(s: Sort) {
    if (s === sort) return;
    setSort(s);
    write(KEYS.boardSort, s);
    track('board_sort', { mode: s });
  }

  // ---------- posting ----------
  const count = graphemeCount(draft);
  const announceCount = Math.floor(count / 10) * 10;
  function onInput(v: string) {
    setDraft(v);
    setError(null);
    write(KEYS.boardDraft, v);
  }
  async function submit(e: Event) {
    e.preventDefault();
    if (sending) return;
    const check = checkText(draft);
    if (!check.ok) {
      setError(check.code);
      return;
    }
    setSending(true);
    setError(null);
    const tempId = `tmp-${Date.now()}`;
    const optimistic: Note = {
      id: tempId,
      crewNo: nextNo ?? 0,
      status: 'visible',
      body: check.text,
      createdAt: new Date().toISOString(),
      mine: true,
      pending: true,
    };
    setNotes((n) => [optimistic, ...n]);
    try {
      const token = ts.current ? await ts.current.token() : '';
      const { data, error: err } = await actions.board.post({ body: draft, turnstileToken: token });
      ts.current?.reset();
      if (err || !data) {
        setNotes((n) => n.filter((x) => x.id !== tempId));
        const code = err?.message && ERRORS[err.message] ? err.message : err ? 'INTERNAL' : 'NETWORK';
        if (code === 'PAUSED') setPaused(true);
        setError(code);
        track('note_post', { status: `error:${code}` });
        return;
      }
      const m: Mine = {
        id: data.id,
        crewNo: data.crewNo,
        undoToken: data.undoToken,
        undoUntil: data.undoUntil,
        status: data.status,
        body: check.text,
        createdAt: data.createdAt,
      };
      const nextMine = [...readMine(), m].slice(-20);
      write(KEYS.boardMine, nextMine);
      setMine(nextMine);
      setNotes((n) =>
        n.map((x) =>
          x.id === tempId
            ? {
                id: data.id,
                crewNo: data.crewNo,
                status: data.status,
                body: check.text,
                createdAt: data.createdAt,
                mine: true,
              }
            : x,
        ),
      );
      setNextNo(data.crewNo + 1);
      if (data.status === 'visible') setTotal((t) => (t ?? 0) + 1);
      setDraft('');
      write(KEYS.boardDraft, '');
      setToast(
        data.status === 'held'
          ? say('ちょっとだけ確認してから貼られます ⚓', 'Waiting for a quick check ⚓')
          : say(`クルー #${data.crewNo} として貼りました ⚓`, `Pinned as Aqua Crew #${data.crewNo} ⚓`),
      );
      setTimeout(() => setToast(null), 4000);
      track('note_post', { status: data.status });
    } catch {
      setNotes((n) => n.filter((x) => x.id !== tempId));
      setError('NETWORK');
      track('note_post', { status: 'error:NETWORK' });
    } finally {
      setSending(false);
    }
  }
  async function undo(m: Mine) {
    const { error: err } = await actions.board.undo({ messageId: m.id, undoToken: m.undoToken });
    const rest = readMine().filter((x) => x.id !== m.id);
    write(KEYS.boardMine, rest);
    setMine(rest);
    if (err) {
      setToast(say('取り消せる時間（10分）を過ぎました。', 'The 10-minute undo window has passed.'));
      setTimeout(() => setToast(null), 4000);
      return;
    }
    setNotes((n) => n.filter((x) => x.id !== m.id));
    if (m.status === 'visible') setTotal((t) => Math.max(0, (t ?? 1) - 1));
    setDraft(m.body);
    write(KEYS.boardDraft, m.body);
    track('note_undo');
  }

  // own held notes are shown to their poster only
  const heldMine = mine
    .filter((m) => m.status === 'held' && !notes.some((n) => n.id === m.id))
    .map<Note>((m) => ({
      id: m.id,
      crewNo: m.crewNo,
      status: 'held',
      body: m.body,
      createdAt: m.createdAt,
      mine: true,
    }));
  const shown = sort === 'new' ? [...heldMine, ...notes] : [...notes, ...heldMine];
  const now = Date.now();
  const undoable = new Map(mine.filter((m) => new Date(m.undoUntil).getTime() > now).map((m) => [m.id, m]));
  const preview = nextNo ?? (total != null ? total + 1 : null);

  return (
    <div class="board-app">
      {/* ---------------- composer ---------------- */}
      <div class="composer-col">
        {paused ? (
          <div class="compose compose--resting card" role="status">
            <p class="maru">
              {say(
                'ボードは今日はお休みです。また来てね ⚓',
                'The board is resting today. Please come back soon ⚓',
              )}
            </p>
            <p class="credit">{say('読むことはいつでもできます。', 'Reading still works.')}</p>
          </div>
        ) : (
          <form class="compose" onSubmit={submit} noValidate>
            <span class="compose__as" aria-live="polite">
              あくあクルー <em>AQUA CREW #{preview != null ? preview.toLocaleString('en-US') : '…'}</em>
            </span>
            <label class="sr-only" for="note-body">
              {say('あくあへのメッセージ', 'Your message for Aqua')}
            </label>
            <textarea
              id="note-body"
              class="compose__ta"
              rows={5}
              value={draft}
              onInput={(e) => onInput((e.target as HTMLTextAreaElement).value)}
              placeholder={say('あくあへのメッセージを書いてね…', 'Write your message for Aqua…')}
              aria-describedby="note-count note-rules note-error"
              aria-invalid={error ? 'true' : undefined}
              maxLength={1200}
            />
            <div class="compose__row">
              <span class={`compose__count${count > LIMITS.maxLen ? ' is-over' : ''}`} id="note-count">
                <b>{count}</b> / {LIMITS.maxLen}
                <span class="sr-only" aria-live="polite">
                  {say(`${announceCount}文字`, `${announceCount} characters`)}
                </span>
              </span>
              <button
                type="submit"
                class="btn btn--primary"
                disabled={sending || count === 0 || count > LIMITS.maxLen}
              >
                {sending ? say('貼っています…', 'Pinning…') : say('貼る', 'Pin it')}
                <svg class="icon" aria-hidden="true">
                  <use href="#i-anchor" />
                </svg>
              </button>
            </div>
            <div class="compose__ts" ref={tsEl} role="group" aria-label="Bot check" />
            {error && (
              <p class="compose__error" id="note-error" role="alert">
                <span aria-hidden="true">⚠ </span>
                {pickL(ERRORS[error] ?? ERRORS.INTERNAL!)}
                {error === 'NETWORK' && (
                  <button
                    type="button"
                    class="btn btn--ghost"
                    style="min-height:30px;padding:4px 10px"
                    onClick={submit}
                  >
                    {say('もう一度', 'Retry')}
                  </button>
                )}
              </p>
            )}
            <div class="compose__rules" id="note-rules">
              <b>BEFORE YOU PIN</b>
              <span>{say('やさしい言葉で', 'Kind words only')}</span>
              <i aria-hidden="true">✦</i>
              <span>{say('リンクなし', 'No links')}</span>
              <i aria-hidden="true">✦</i>
              <span>{say('個人情報なし', 'No personal info')}</span>
              <br />
              {say(
                '番号は貼られたときに決まります。寄せ書きは通報でき、アーカイブの管理人が確認します。寄せ書きはファンが書いたもので、本人やCOVERのものではありません。',
                'Your number is given when the note lands. Notes can be reported and are checked by the archive keeper. Notes are written by fans, not by Aqua or COVER.',
              )}{' '}
              <a href="/privacy#board">{say('データの扱いについて', 'How we handle your data')}</a>
            </div>
            <svg class="compose__cat" viewBox="0 0 74 60" aria-hidden="true">
              <path
                d="M12 50c-4-14 2-28 12-34l-4-12 12 8c4-1 8-1 12 0l12-8-4 12c10 6 16 20 12 34z"
                fill="#fff"
                stroke="#F2A7CF"
                stroke-width="3"
                stroke-linejoin="round"
              />
              <path
                d="M26 34q2 2 4 0M44 34q2 2 4 0M34 40q3 2 6 0"
                fill="none"
                stroke="#F2A7CF"
                stroke-width="3"
                stroke-linecap="round"
              />
            </svg>
          </form>
        )}
      </div>

      {/* ---------------- board ---------------- */}
      <section class="board" aria-labelledby="board-title">
        <div class="board__head">
          <h2 id="board-title" class="ribbon">
            <svg class="icon" aria-hidden="true">
              <use href="#i-anchor" />
            </svg>
            CREW BOARD <small lang="ja">寄せ書きボード</small>
          </h2>
          <span class="board__total">
            {total != null && (
              <>
                <b>{total.toLocaleString('en-US')}</b> {say('枚の寄せ書き', 'NOTES PINNED')}
              </>
            )}
          </span>
          <div class="seg" role="radiogroup" aria-label={say('並び順', 'Sort')}>
            <button
              type="button"
              role="radio"
              aria-checked={sort === 'new'}
              onClick={() => changeSort('new')}
            >
              {say('新着', 'NEWEST')}
            </button>
            <button
              type="button"
              role="radio"
              aria-checked={sort === 'random'}
              onClick={() => changeSort('random')}
            >
              {say('ランダム', 'RANDOM')}
            </button>
          </div>
        </div>

        {toast && (
          <p class="toast" role="status">
            {toast}
          </p>
        )}

        <div class="notes" aria-busy={loading ? 'true' : 'false'} aria-live="off">
          {shown.map((n) => {
            const st = style(n.crewNo);
            const isReported = reported.includes(n.id);
            const u = undoable.get(n.id);
            if (n.status === 'under_review')
              return (
                <article class="note note--rest" style={`--tilt:${st.tilt}deg`} aria-labelledby={`n-${n.id}`}>
                  <h3 class="note__who" id={`n-${n.id}`}>
                    Aqua Crew #{n.crewNo}
                    <em lang="ja">あくあクルー</em>
                  </h3>
                  <p>
                    {say(
                      'この寄せ書きは、アーカイブの管理人が確認するまでお休み中です。⚓',
                      'This note is resting while the archive keeper takes a look. ⚓',
                    )}
                  </p>
                  <div class="note__foot">
                    <span>UNDER REVIEW</span>
                  </div>
                </article>
              );
            return (
              <article
                class={`note${n.pending ? ' is-pending' : ''}${n.mine ? ' is-mine' : ''}${n.status === 'held' ? ' is-held' : ''}${n.mine && motion.value === 'on' ? ' thunk' : ''}`}
                style={`--note-bg:${st.paper};--tilt:${st.tilt}deg`}
                aria-labelledby={`n-${n.id}`}
              >
                {st.holder === 'pin' ? (
                  <svg class="pin" aria-hidden="true">
                    <use href="#i-pin" />
                  </svg>
                ) : (
                  <span class={`tape ${st.holder === 'tape' ? '' : st.holder}`} aria-hidden="true" />
                )}
                <h3 class="note__who" id={`n-${n.id}`}>
                  Aqua Crew #{n.pending ? '…' : n.crewNo}
                  <em lang="ja">あくあクルー</em>
                </h3>
                <p class="note__body">{n.body}</p>
                {n.status === 'held' && (
                  <p class="note__held">
                    {say(
                      'ちょっとだけ確認中（あなたにだけ見えています）',
                      'Waiting for a quick check (only you can see this)',
                    )}
                  </p>
                )}
                <div class="note__foot">
                  <time dateTime={n.createdAt}>{jstDate(n.createdAt)}</time>
                  {u && (
                    <button type="button" class="chip note__undo" onClick={() => undo(u)}>
                      {say('取り消す（10分）', 'Undo (10 min)')}
                    </button>
                  )}
                  {!n.mine && n.status === 'visible' && (
                    <button
                      type="button"
                      class={`note__flag${reporting === n.id ? ' is-on' : ''}`}
                      aria-label={
                        isReported
                          ? say(`#${n.crewNo} は通報済み`, `Note #${n.crewNo} reported`)
                          : say(`#${n.crewNo} を通報`, `Report note #${n.crewNo}`)
                      }
                      aria-expanded={reporting === n.id}
                      disabled={isReported}
                      onClick={() => setReporting((r) => (r === n.id ? null : n.id))}
                    >
                      <svg class="icon" aria-hidden="true">
                        <use href="#i-flag" />
                      </svg>
                    </button>
                  )}
                </div>
                {reporting === n.id && (
                  <ReportPopover
                    note={n}
                    siteKey={siteKey}
                    onClose={() => setReporting(null)}
                    onDone={() => {
                      const next = [...reported, n.id].slice(-200);
                      setReported(next);
                      write(KEYS.boardReported, next);
                    }}
                  />
                )}
              </article>
            );
          })}
          {loading &&
            Array.from({ length: notes.length ? 4 : 8 }, (_, i) => (
              <div
                class="note note--skeleton skeleton"
                style={`--tilt:${TILTS[i % 4]}deg`}
                aria-hidden="true"
              />
            ))}
        </div>

        {!loading && !failed && shown.length === 0 && (
          <div class="empty">
            <svg class="icon" aria-hidden="true">
              <use href="#i-catsleep" />
            </svg>
            <p>
              {say(
                'まだ寄せ書きはありません。最初の一枚をどうぞ ⚓',
                'No notes yet — be the first to pin one ⚓',
              )}
            </p>
          </div>
        )}
        {failed && (
          <div class="empty" role="alert">
            <p>{say('寄せ書きを読み込めませんでした。', "Couldn't load the notes.")}</p>
            <button type="button" class="btn btn--secondary" onClick={() => load(notes.length === 0)}>
              {say('もう一度', 'Try again')}
            </button>
          </div>
        )}
        <div ref={sentinel} />
        {cursor != null && !loading && (
          <p style="text-align:center;margin-top:18px">
            <button type="button" class="btn btn--secondary" onClick={() => load(false)}>
              {say('もっと見る', 'Load more notes')}
            </button>
          </p>
        )}
      </section>
    </div>
  );
}

function ReportPopover({
  note,
  siteKey,
  onClose,
  onDone,
}: {
  note: Note;
  siteKey: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const L = lang.value;
  const say = (ja: string, en: string) => (L === 'ja' ? ja : en);
  const [reason, setReason] = useState<string | null>(null);
  const [text, setText] = useState('');
  const [state, setState] = useState<'idle' | 'sending' | 'done' | 'error'>('idle');
  const [needReason, setNeedReason] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const tsEl = useRef<HTMLDivElement>(null);
  const ts = useRef<Widget | null>(null);

  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    ref.current?.querySelector<HTMLInputElement>('input[type="radio"]')?.focus();
    if (siteKey && tsEl.current)
      mountTurnstile(tsEl.current, siteKey, L)
        .then((w) => (ts.current = w))
        .catch(() => undefined);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }
      if (e.key === 'Tab' && ref.current) {
        const f = Array.from(
          ref.current.querySelectorAll<HTMLElement>('input,textarea,button:not([disabled])'),
        );
        const first = f[0];
        const last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener('keydown', onKey, true);
    return () => {
      document.removeEventListener('keydown', onKey, true);
      ts.current?.destroy();
      prev?.focus?.();
    };
  }, []);

  async function send() {
    if (!reason) {
      setNeedReason(true);
      return;
    }
    setState('sending');
    try {
      const token = ts.current ? await ts.current.token() : '';
      const { error } = await actions.board.report({
        messageId: note.id,
        reason: reason as (typeof REASONS)[number]['id'],
        note: text.trim() || undefined,
        turnstileToken: token,
      });
      if (error) {
        setState('error');
        return;
      }
      setState('done');
      onDone();
      track('note_report', { reason });
      setTimeout(onClose, 1800);
    } catch {
      setState('error');
    }
  }

  return (
    <div
      class="popover report-pop"
      ref={ref}
      role="dialog"
      aria-modal="true"
      aria-labelledby={`rp-${note.id}`}
    >
      {state === 'done' ? (
        <p role="status" class="maru">
          {say('ありがとう。管理人が確認します。', 'Thank you — the keeper will check it.')}
        </p>
      ) : (
        <>
          <h4 id={`rp-${note.id}`}>
            {say('この寄せ書きを通報', 'Report this note')}
            <small>
              {say(
                'どこが問題か教えてください。通報は匿名です。',
                "Tell the keeper what's wrong. Reports are anonymous.",
              )}
            </small>
          </h4>
          <fieldset class="report-pop__opts" aria-describedby={needReason ? `rp-err-${note.id}` : undefined}>
            <legend class="sr-only">{say('理由', 'Reason')}</legend>
            {REASONS.map((r) => (
              <label class={`opt${reason === r.id ? ' is-on' : ''}`}>
                <input
                  type="radio"
                  name={`reason-${note.id}`}
                  value={r.id}
                  checked={reason === r.id}
                  onChange={() => (setReason(r.id), setNeedReason(false))}
                />
                {say(r.ja, r.en)}
              </label>
            ))}
          </fieldset>
          {needReason && (
            <p class="compose__error" id={`rp-err-${note.id}`} role="alert">
              {say('理由をえらんでください。', 'Please choose a reason.')}
            </p>
          )}
          <label class="sr-only" for={`rp-note-${note.id}`}>
            {say('管理人へのメモ（任意）', 'A note for the keeper (optional)')}
          </label>
          <textarea
            id={`rp-note-${note.id}`}
            class="report-pop__why"
            rows={2}
            maxLength={200}
            value={text}
            placeholder={say('管理人へのメモ（任意）', 'Add a note for the keeper (optional)')}
            onInput={(e) => setText((e.target as HTMLTextAreaElement).value)}
          />
          <div class="compose__ts" ref={tsEl} />
          {state === 'error' && (
            <p class="compose__error" role="alert">
              {say(
                '送信できませんでした。もう一度お試しください。',
                "Couldn't send the report. Please try again.",
              )}
            </p>
          )}
          <div class="report-pop__acts">
            <button type="button" class="btn btn--ghost" onClick={onClose}>
              {say('キャンセル', 'Cancel')}
            </button>
            <button type="button" class="btn btn--navy" onClick={send} disabled={state === 'sending'}>
              {state === 'sending' ? '…' : say('通報する', 'Send report')}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
