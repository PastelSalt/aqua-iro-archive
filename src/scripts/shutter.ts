/**
 * Chapter-change shutter (see components/chrome/Shutter.astro). Hooks ClientRouter:
 * - astro:before-preparation → close the panels over the destination's number + name (180 ms) while the
 *   next page loads; on the first visit to that chapter this session, hold 600 ms on its pose
 *   (a click or any key skips the hold);
 * - astro:after-swap → open the panels on the new page (240 ms).
 * Same-page hash moves and Motion OFF skip it entirely (page changes then cut straight across).
 */
import type { TransitionBeforePreparationEvent } from 'astro:transitions/client';

type Info = { no: string; en: string; ja: string; tint: string; id: string; pose: string };
const SEEN = 'aia:eyecatch';
const CLOSE_MS = 180;
const OPEN_MS = 240;
const HOLD_MS = 600;

let closed = false;

const el = () => document.querySelector<HTMLElement>('[data-shutter]');
const motionOn = () => document.documentElement.dataset.motion === 'on';
function seen(): string[] {
  try {
    return JSON.parse(sessionStorage.getItem(SEEN) ?? '[]') as string[];
  } catch {
    return [];
  }
}
function markSeen(id: string) {
  try {
    sessionStorage.setItem(SEEN, JSON.stringify([...new Set([...seen(), id])]));
  } catch {
    /* storage blocked: the eyecatch just shows again next time */
  }
}
const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

function fill(sh: HTMLElement, info: Info, eyecatch: boolean) {
  sh.style.setProperty('--shutter-tint', `var(${info.tint})`);
  sh.querySelector('.shutter__no')!.textContent = info.no.replace('NO.', 'No.');
  sh.querySelector('.shutter__en')!.textContent = info.en.toUpperCase();
  sh.querySelector('.shutter__ja')!.textContent = info.ja;
  const pose = sh.querySelector<HTMLImageElement>('.shutter__pose')!;
  if (eyecatch && info.pose) pose.src = info.pose;
  sh.classList.toggle('is-eyecatch', eyecatch && !!info.pose);
}

async function close(sh: HTMLElement) {
  sh.classList.remove('is-opening');
  sh.classList.add('is-closing');
  await wait(CLOSE_MS);
  closed = true;
}

function holdSkippable(sh: HTMLElement): Promise<void> {
  return new Promise((resolve) => {
    const done = () => {
      clearTimeout(t);
      sh.removeEventListener('pointerdown', done);
      document.removeEventListener('keydown', done, true);
      resolve();
    };
    const t = setTimeout(done, HOLD_MS);
    sh.addEventListener('pointerdown', done);
    document.addEventListener('keydown', done, true);
  });
}

// Motion OFF: page changes cut straight across, so Astro's native view transition is pure cost — its snapshot
// of the old page takes seconds on GPU-less WebKit. Run the swap without one; Motion ON is untouched.
const nativeVT = document.startViewTransition?.bind(document);
if (nativeVT)
  document.startViewTransition = ((arg?: Parameters<typeof nativeVT>[0]) => {
    if (motionOn()) return nativeVT(arg);
    const update = typeof arg === 'function' ? arg : arg?.update;
    const done = Promise.resolve()
      .then(() => update?.())
      .then(() => undefined);
    const settled = done.catch(() => undefined);
    return {
      updateCallbackDone: done,
      ready: settled,
      finished: settled,
      skipTransition() {},
      types: new Set<string>(),
    } as unknown as ViewTransition;
  }) as typeof document.startViewTransition;

document.addEventListener('astro:before-preparation', (ev) => {
  const e = ev as TransitionBeforePreparationEvent;
  const sh = el();
  if (!sh || !motionOn() || e.to.pathname === location.pathname) return;
  let map: Record<string, Info> = {};
  try {
    map = JSON.parse(sh.dataset.chapters ?? '{}') as Record<string, Info>;
  } catch {
    /* no data: plain shutter */
  }
  const path = e.to.pathname.replace(/\/+$/, '') || '/';
  const info = map[path] ?? {
    no: '',
    en: 'AQUA IRO ARCHIVE',
    ja: 'あくあ色アーカイブ',
    tint: '--lavender',
    id: path,
    pose: '',
  };
  const eyecatch = !!map[path] && !seen().includes(info.id);
  fill(sh, info, eyecatch);
  const closing = close(sh).then(async () => {
    if (!eyecatch) return;
    sh.classList.add('is-holding');
    markSeen(info.id);
    await holdSkippable(sh);
  });
  const load = e.loader;
  e.loader = async () => {
    await Promise.all([load(), closing]);
  };
});

document.addEventListener('astro:after-swap', () => {
  const sh = el();
  if (!sh || !closed) return;
  closed = false;
  sh.classList.remove('is-closing', 'is-holding');
  sh.classList.add('is-opening');
  setTimeout(() => sh.classList.remove('is-opening', 'is-eyecatch'), OPEN_MS + 40);
});
