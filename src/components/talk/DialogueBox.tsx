/**
 * Talk with Aqua dialogue box (EXECUTIONPLAN §10.4).
 * hidden ⇄ idle → speaking(i) → choosing → responding(i) → (choosing | ended) → idle
 * Server-rendered with the first line so it shows text without JS; hydrates client:idle and fetches /talk.json.
 */
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { navigate } from 'astro:transitions/client';
import { lang, motion } from '../../lib/prefs';
import { KEYS, read, write } from '../../lib/storage';
import { track } from '../../lib/analytics';
import { CHAPTERS } from '../../lib/chapters';
import { activeContexts, matches } from '../../lib/talk/context';
import { pickChoices, pickConversation, cryptoRand } from '../../lib/talk/picker';
import { loadScript, logLine, markFound } from '../../lib/talk/store';
import type { Choice, CompiledScript, Conversation, Line } from '../../lib/talk/types';
import { useLang } from '../../lib/useLang';

type Phase = 'idle' | 'speaking' | 'choosing' | 'ended';
type Props = { first: { ja: string; en: string } };

const GOODBYES: Line[] = [
  { exp: 'smile', ja: 'またね！いつでも話しかけてね。', en: 'See you! Talk to me anytime.' },
  { exp: 'cheerful', ja: 'たのしかった！またおしゃべりしよ。', en: 'That was fun! Let’s chat again.' },
  { exp: 'smile', ja: 'またね、ご主人様！', en: 'See you later, Master!' },
];
const today = () => new Date().toISOString().slice(0, 10);

function textOf(l: Line | { ja?: string; en?: string }, L: 'ja' | 'en') {
  return (L === 'ja' ? (l.ja ?? l.en) : (l.en ?? l.ja)) ?? '';
}

export default function DialogueBox({ first }: Props) {
  const [script, setScript] = useState<CompiledScript | null>(null);
  const [hidden, setHidden] = useState(false);
  const [phase, setPhase] = useState<Phase>('idle');
  const [queue, setQueue] = useState<Line[]>([]);
  const [shown, setShown] = useState(''); // typed text
  const [full, setFull] = useState<string | null>(null); // current full line (null = initial static line)
  const [typing, setTyping] = useState(false);
  const [auto, setAuto] = useState(false);
  const [choices, setChoices] = useState<Choice[]>([]);
  const [goto, setGoto] = useState<Choice['goto']>();
  const [sticker, setSticker] = useState<string | null>(null);
  const [announce, setAnnounce] = useState('');
  const conv = useRef<Conversation | null>(null);
  const node = useRef<string | null>(null);
  const after = useRef<'choices' | 'end' | 'idle'>('idle');
  const chose = useRef(false);
  const typer = useRef<ReturnType<typeof setTimeout>>();
  const autoT = useRef<ReturnType<typeof setTimeout>>();
  const idleCount = useRef(0);
  const hovered = useRef(false);
  const boxRef = useRef<HTMLDivElement>(null);
  const loadedAt = useRef(Date.now());
  const L = useLang();
  const say = (ja: string, en: string) => (L === 'ja' ? ja : en);

  // ---------- load ----------
  useEffect(() => {
    setHidden(read<boolean>(KEYS.talkHidden, false));
    loadScript()
      .then(setScript)
      .catch(() => undefined);
  }, []);

  // ---------- expression → hero pose / sticker ----------
  function express(exp: string) {
    const e = script?.expressions[exp];
    if (!e) return;
    setSticker(e.pose ? null : e.sticker);
    if (e.pose) window.dispatchEvent(new CustomEvent('aia:expression', { detail: { pose: e.pose } }));
  }
  function resetPose() {
    setSticker(null);
    window.dispatchEvent(new CustomEvent('aia:expression', { detail: { pose: null } }));
  }

  // ---------- typewriter ----------
  function type(line: Line, who: 'aqua' = 'aqua') {
    const t = textOf(line, lang.value);
    clearTimeout(typer.current);
    clearTimeout(autoT.current);
    express(line.exp);
    setFull(t);
    logLine({ who, ja: line.ja, en: line.en });
    if (motion.value !== 'on') {
      setShown(t);
      setTyping(false);
      setAnnounce(t);
      return;
    }
    const chars = [...t];
    const per = lang.value === 'ja' ? 35 : 18;
    let i = 0;
    setShown('');
    setTyping(true);
    const step = () => {
      i++;
      setShown(chars.slice(0, i).join(''));
      if (i >= chars.length) {
        setTyping(false);
        setAnnounce(t);
        return;
      }
      typer.current = setTimeout(step, /[。！？…!?.,、]/.test(chars[i - 1]!) ? 180 : per);
    };
    step();
  }
  function finishLine() {
    clearTimeout(typer.current);
    if (full != null) setShown(full);
    setTyping(false);
    setAnnounce(full ?? '');
  }

  // ---------- flow ----------
  function playLines(lines: Line[], then: 'choices' | 'end' | 'idle') {
    after.current = then;
    const [head, ...rest] = lines;
    setQueue(rest);
    setChoices([]);
    setPhase('speaking');
    if (head) type(head);
  }
  function open() {
    if (!script) {
      setShown('…');
      setFull('…');
      setTimeout(() => script && open(), 1000);
      return;
    }
    if (phase === 'speaking' || phase === 'choosing') return;
    setGoto(undefined);
    const active = activeContexts({ now: new Date(), firstVisit: !read<string | null>(KEYS.visited, null) });
    const recent = read<string[]>(KEYS.talkRecent, [], 'session');
    const seen = read<{ d: string; ids: string[] }>(KEYS.talkSeenToday, { d: '', ids: [] });
    const c = pickConversation(
      script.conversations,
      active,
      recent,
      read(KEYS.talkAlbum, {}),
      seen.d === today() ? seen.ids : [],
      cryptoRand,
    );
    if (!c) return;
    conv.current = c;
    node.current = null;
    chose.current = false;
    write(KEYS.talkRecent, [...recent.filter((x) => x !== c.id), c.id].slice(-8), 'session');
    if (c.when.some((w) => ['birthday', 'anniversary', 'graduation'].includes(w)))
      write(KEYS.talkSeenToday, { d: today(), ids: [...(seen.d === today() ? seen.ids : []), c.id] });
    track('talk_start', { conv: c.id });
    playLines(c.lines, 'choices');
  }
  function advance() {
    if (typing) return finishLine();
    if (phase === 'idle' || phase === 'ended') return open();
    if (phase !== 'speaking') return;
    if (queue.length) {
      const [head, ...rest] = queue;
      setQueue(rest);
      type(head!);
      return;
    }
    // lines finished
    if (after.current === 'choices') {
      const pool = node.current
        ? (conv.current?.nodes[node.current]?.choices ?? [])
        : (conv.current?.choices ?? []);
      if (pool.length) {
        setChoices(pickChoices(pool, cryptoRand));
        setPhase('choosing');
        return;
      }
      return end();
    }
    if (after.current === 'end') return end();
    setPhase('idle');
  }
  function pick(ch: Choice) {
    const c = conv.current!;
    if (!chose.current) {
      track('talk_choice', { conv: c.id, choice: ch.id });
      chose.current = true;
    }
    logLine({ who: 'you', ja: ch.ja, en: ch.en });
    if (ch.goto) setGoto(ch.goto);
    if (ch.next && c.nodes[ch.next]) {
      const nx = c.nodes[ch.next]!;
      node.current = ch.next;
      playLines([...ch.reply, ...nx.lines], nx.choices.length ? 'choices' : 'end');
    } else {
      playLines(ch.reply, 'end');
    }
  }
  function end() {
    const c = conv.current;
    if (c) {
      markFound(c.id);
      track('talk_end', { conv: c.id });
      if (!read<string | null>(KEYS.visited, null)) write(KEYS.visited, new Date().toISOString());
    }
    setChoices([]);
    setPhase('ended');
    type(GOODBYES[Math.floor(cryptoRand() * GOODBYES.length)]!);
    setTimeout(resetPose, 2500);
  }
  function hide() {
    setHidden(true);
    write(KEYS.talkHidden, true);
    track('talk_hide');
    clearTimeout(typer.current);
    resetPose();
  }
  function reopen() {
    setHidden(false);
    write(KEYS.talkHidden, false);
    requestAnimationFrame(() => boxRef.current?.querySelector<HTMLButtonElement>('[data-advance]')?.focus());
  }
  function takeMeThere() {
    const c = CHAPTERS.find((x) => x.id === goto);
    if (!c) return;
    track('talk_goto', { to: c.id });
    track('dock_nav', { to: c.id, via: 'talk' });
    navigate(c.href);
  }

  // ---------- AUTO ----------
  useEffect(() => {
    clearTimeout(autoT.current);
    if (!auto || typing || phase !== 'speaking' || hovered.current) return;
    const len = [...(full ?? '')].length;
    autoT.current = setTimeout(() => !document.hidden && advance(), Math.max(1200, len * 60));
    return () => clearTimeout(autoT.current);
  }, [auto, typing, phase, full, queue]);

  // ---------- idle chatter ----------
  useEffect(() => {
    if (!script || hidden) return;
    let t: ReturnType<typeof setTimeout>;
    const schedule = () => {
      t = setTimeout(
        () => {
          const ok =
            phase === 'idle' &&
            !document.hidden &&
            motion.value === 'on' &&
            idleCount.current < 6 &&
            Date.now() - loadedAt.current > 5000 &&
            !hovered.current;
          if (ok) {
            const active = activeContexts({
              now: new Date(),
              firstVisit: !read<string | null>(KEYS.visited, null),
            });
            const pool = script.idle.filter((l) => matches(l.when, active));
            if (pool.length) {
              idleCount.current++;
              type(pool[Math.floor(cryptoRand() * pool.length)]!);
            }
          }
          schedule();
        },
        20_000 + cryptoRand() * 10_000,
      );
    };
    schedule();
    return () => clearTimeout(t);
  }, [script, hidden, phase]);

  // ---------- keyboard: 1–3 picks while choosing (captured so the dock's chapter keys don't fire) ----------
  useEffect(() => {
    if (phase !== 'choosing') return;
    const onKey = (e: KeyboardEvent) => {
      const n = Number(e.key);
      if (!Number.isInteger(n) || n < 1 || n > choices.length || e.altKey || e.ctrlKey || e.metaKey) return;
      const t = e.target as HTMLElement;
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName)) return;
      e.preventDefault();
      e.stopPropagation();
      pick(choices[n - 1]!);
    };
    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
  }, [phase, choices]);

  useEffect(() => () => (clearTimeout(typer.current), clearTimeout(autoT.current), resetPose()), []);

  const initial = useMemo(() => first, [first]);

  if (hidden) {
    return (
      <div class="talk">
        <button type="button" class="talk-tab" onClick={reopen}>
          <svg class="icon" aria-hidden="true">
            <use href="#i-anchor" />
          </svg>
          {say('あくあと話す', 'Talk with Aqua')}
        </button>
      </div>
    );
  }

  return (
    <div
      class="talk"
      ref={boxRef}
      onMouseEnter={() => (hovered.current = true)}
      onMouseLeave={() => (hovered.current = false)}
    >
      {phase === 'choosing' && (
        <ol class="choices talk__choices" role="list" aria-label={say('選択肢', 'Choices')}>
          {choices.map((c, i) => (
            <li style={`--i:${i}`} class="rise">
              <button type="button" class="choice" onClick={() => pick(c)} autoFocus={i === 0}>
                <span class="choice__n" aria-hidden="true">
                  {i + 1}
                </span>
                <span lang={L === 'ja' ? (c.ja ? 'ja' : 'en') : c.en ? 'en' : 'ja'}>{textOf(c, L)}</span>
              </button>
            </li>
          ))}
        </ol>
      )}
      <div class="dialog-box">
        <span class="dialog-box__name">
          あくあ<span>AQUA</span>
          {sticker && (
            <span class="dialog-box__emote pop" aria-hidden="true">
              <svg class="icon" style="width:20px;height:20px">
                <use href={`#i-${sticker}`} />
              </svg>
            </span>
          )}
        </span>
        <div class="dialog-box__ctrls">
          <button type="button" onClick={finishLine} disabled={!typing} aria-label={say('スキップ', 'Skip')}>
            SKIP ▸▸
          </button>
          <button type="button" aria-pressed={auto} onClick={() => setAuto((v) => !v)}>
            AUTO
          </button>
          <button
            type="button"
            onClick={() =>
              window.dispatchEvent(new CustomEvent('aia:log', { detail: { open: true, tab: 'backlog' } }))
            }
          >
            LOG
          </button>
          <button type="button" onClick={hide} aria-label={say('会話をかくす', 'Hide the conversation')}>
            ✕
          </button>
        </div>
        <button
          type="button"
          class="dialog-box__open"
          data-advance
          aria-label={
            phase === 'idle' || phase === 'ended'
              ? say('あくあに話しかける', 'Talk to Aqua')
              : say('次へ', 'Next')
          }
          onClick={advance}
          disabled={phase === 'choosing'}
        />
        <p class="dialog-box__text" aria-hidden={full != null ? 'true' : undefined}>
          {full == null ? (
            <>
              <span lang="ja">{initial.ja}</span>
              <br />
              <span lang="en" class="muted">
                {initial.en}
              </span>
            </>
          ) : (
            <span lang={L}>{shown}</span>
          )}
        </p>
        <p class="sr-only" aria-live="polite">
          {announce}
        </p>
        {phase !== 'choosing' && (
          <span class="dialog-box__cursor" aria-hidden="true">
            ▼
          </span>
        )}
        {goto && (phase === 'ended' || phase === 'idle') && (
          <button type="button" class="btn btn--primary talk__goto" onClick={takeMeThere}>
            {say('連れてって！', 'Take me there →')}
          </button>
        )}
      </div>
      <p class="dialog-box__note">
        {say(
          '※ セリフはこのアーカイブのためのファン創作です。',
          '※ Lines are fan-written for this archive, not her actual words.',
        )}
      </p>
    </div>
  );
}
