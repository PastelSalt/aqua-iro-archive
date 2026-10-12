/**
 * Lightbox (EXECUTIONPLAN §9.6 / §8.8): one <dialog> with showModal(), blurred mint backdrop,
 * credit bar fixed at the bottom, focus returned to the trigger on close.
 *
 * Triggers (delegated, so they work on every page after ClientRouter swaps):
 *   video: <a data-lb="video" data-yt="ID" data-title="…" data-credit="…" data-event="clip_open" href="https://youtube…">
 *   image: <a data-lb="image" data-group="arts" data-id="…" href="large.jpg" data-srcset="…" data-alt="…"
 *             data-title="…" data-credit="…" data-source="…">
 * Without JS the anchors simply open YouTube / the image file.
 */
import { track, type EventName } from '../lib/analytics';

type Trigger = HTMLElement & { dataset: DOMStringMap };
const lang = () => (document.documentElement.dataset.lang === 'en' ? 'en' : 'ja');
const say = (ja: string, en: string) => (lang() === 'ja' ? ja : en);

let dialog: HTMLDialogElement | null = null;
let returnFocus: HTMLElement | null = null;
let group: Trigger[] = [];
let index = 0;
let liteLoaded: Promise<unknown> | null = null;

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Record<string, string> = {},
  text?: string,
) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  if (text) e.textContent = text;
  return e;
}
function iconBtn(cls: string, icon: string, label: string) {
  const b = el('button', { type: 'button', class: cls, 'aria-label': label });
  b.innerHTML = `<svg class="icon" aria-hidden="true"><use href="#i-${icon}"></use></svg>`;
  return b;
}

function ensureDialog(): HTMLDialogElement {
  if (dialog && document.body.contains(dialog)) return dialog;
  dialog = el('dialog', { class: 'lightbox', 'aria-label': 'Viewer' }) as HTMLDialogElement;
  dialog.innerHTML = `<div class="lightbox__top"></div><div class="lightbox__stage" data-stage></div><div class="lightbox__credit" data-credit aria-live="polite"></div>`;
  const close = iconBtn('lightbox__close', 'close', say('閉じる', 'Close'));
  close.addEventListener('click', () => dialog!.close());
  dialog.querySelector('.lightbox__top')!.append(close);
  dialog.addEventListener('close', onClose);
  dialog.addEventListener('click', (e) => {
    if (e.target === dialog || (e.target as HTMLElement).matches('[data-stage]')) dialog!.close();
  });
  dialog.addEventListener('keydown', (e) => {
    if (group.length < 2) return;
    if (e.key === 'ArrowRight') step(1);
    if (e.key === 'ArrowLeft') step(-1);
  });
  // swipe
  let x0: number | null = null;
  dialog.addEventListener('touchstart', (e) => (x0 = e.touches.length === 1 ? e.touches[0]!.clientX : null), {
    passive: true,
  });
  dialog.addEventListener('touchend', (e) => {
    if (x0 == null || group.length < 2) return;
    const dx = e.changedTouches[0]!.clientX - x0;
    if (Math.abs(dx) > 50) step(dx < 0 ? 1 : -1);
    x0 = null;
  });
  document.body.append(dialog);
  return dialog;
}

function onClose() {
  document.body.classList.remove('has-modal');
  const stage = dialog?.querySelector('[data-stage]');
  if (stage) stage.innerHTML = ''; // stops video playback
  if (location.hash.startsWith('#art='))
    history.replaceState(history.state, '', location.pathname + location.search);
  returnFocus?.focus({ preventScroll: true });
  returnFocus = null;
}

function renderCredit(t: Trigger) {
  const c = dialog!.querySelector<HTMLElement>('[data-credit]')!;
  c.innerHTML = '';
  const title = t.dataset.title;
  if (title) c.append(el('b', {}, title));
  if (t.dataset.credit) c.append(el('span', {}, t.dataset.credit));
  if (t.dataset.lb === 'video') {
    const a = el(
      'a',
      { href: `https://www.youtube.com/watch?v=${t.dataset.yt}`, target: '_blank', rel: 'noopener' },
      say('YouTubeで見る ↗', 'Watch on YouTube ↗'),
    );
    c.append(a);
  } else if (t.dataset.source) {
    c.append(
      el('a', { href: t.dataset.source, target: '_blank', rel: 'noopener' }, say('出典 ↗', 'Source ↗')),
    );
  }
  if (group.length > 1) c.append(el('span', { class: 'label' }, `${index + 1} / ${group.length}`));
}

async function renderVideo(t: Trigger) {
  const stage = dialog!.querySelector<HTMLElement>('[data-stage]')!;
  stage.innerHTML = '';
  const box = el('div', { class: 'lightbox__video' });
  const lite = el('lite-youtube', {
    videoid: t.dataset.yt!,
    nocookie: '',
    videotitle: t.dataset.title ?? '',
    videoplay: say('再生', 'Play'),
  });
  box.append(lite);
  stage.append(box);
  liteLoaded ??= import('@justinribeiro/lite-youtube');
  await liteLoaded;
  await customElements.whenDefined('lite-youtube');
  lite.addEventListener(
    'liteYoutubeIframeLoaded',
    () => track('embed_play', { id: t.dataset.yt, page: location.pathname }),
    { once: true },
  );
  (lite as unknown as { addIframe?: () => void }).addIframe?.(); // the visitor already pressed play on the card
}

function renderImage(t: Trigger) {
  const stage = dialog!.querySelector<HTMLElement>('[data-stage]')!;
  stage.innerHTML = '';
  stage.classList.remove('is-zoomed');
  const img = el('img', {
    src: (t as HTMLAnchorElement).href,
    alt: t.dataset.alt ?? '',
    decoding: 'async',
    ...(t.dataset.srcset ? { srcset: t.dataset.srcset, sizes: '100vw' } : {}),
  });
  img.addEventListener('dblclick', () => stage.classList.toggle('is-zoomed'));
  img.addEventListener('click', (e) => {
    e.stopPropagation();
    stage.classList.toggle('is-zoomed');
  });
  stage.append(img);
  if (group.length > 1) {
    const prev = iconBtn('lightbox__nav lightbox__nav--prev', 'chevron', say('前の画像', 'Previous image'));
    (prev.firstElementChild as SVGElement).style.transform = 'scaleX(-1)';
    const next = iconBtn('lightbox__nav lightbox__nav--next', 'chevron', say('次の画像', 'Next image'));
    prev.addEventListener('click', (e) => (e.stopPropagation(), step(-1)));
    next.addEventListener('click', (e) => (e.stopPropagation(), step(1)));
    stage.append(prev, next);
  }
  if (t.dataset.id) history.replaceState(history.state, '', `#art=${t.dataset.id}`);
}

function show(t: Trigger) {
  if (t.dataset.lb === 'video') void renderVideo(t);
  else renderImage(t);
  renderCredit(t);
  dialog!.setAttribute('aria-label', t.dataset.title ?? 'Viewer');
}

function step(d: number) {
  if (!group.length) return;
  index = (index + d + group.length) % group.length;
  const t = group[index]!;
  show(t);
  if (t.dataset.event) track(t.dataset.event as EventName, { id: t.dataset.id ?? t.dataset.yt });
}

export function openLightbox(t: Trigger) {
  const d = ensureDialog();
  returnFocus = t;
  group = t.dataset.group
    ? Array.from(document.querySelectorAll<Trigger>(`[data-lb][data-group="${t.dataset.group}"]`)).filter(
        (x) => x.offsetParent !== null || x === t,
      )
    : [t];
  index = Math.max(0, group.indexOf(t));
  show(t);
  if (!d.open) d.showModal();
  document.body.classList.add('has-modal');
  if (t.dataset.event)
    track(t.dataset.event as EventName, { id: t.dataset.id ?? t.dataset.yt, rank: t.dataset.rank });
}

function onClick(e: MouseEvent) {
  if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
  const t = (e.target as HTMLElement).closest<Trigger>('[data-lb]');
  if (!t) return;
  e.preventDefault();
  openLightbox(t);
}

function openFromHash() {
  const m = /^#art=([\w-]+)$/.exec(location.hash);
  if (!m) return;
  const t = document.querySelector<Trigger>(`[data-lb][data-id="${CSS.escape(m[1]!)}"]`);
  if (t) openLightbox(t);
}

if (!(window as unknown as { __aiaLightbox?: boolean }).__aiaLightbox) {
  (window as unknown as { __aiaLightbox?: boolean }).__aiaLightbox = true;
  // capture phase: runs before ClientRouter's document click handler, which would otherwise navigate to the file
  document.addEventListener('click', onClick, { capture: true });
  document.addEventListener('astro:page-load', openFromHash);
  document.addEventListener('astro:before-swap', () => dialog?.open && dialog.close());
}
