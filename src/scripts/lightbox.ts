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
    const t = e.target as HTMLElement;
    if (t.closest('.lightbox__stage.is-zoomed')) return; // empty space while zoomed: just panning
    if (e.target === dialog || t.matches('[data-stage], .lightbox__pan')) dialog!.close();
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
    // a zoomed image pans with the finger instead of switching pictures
    if (x0 == null || group.length < 2 || dialog!.querySelector('.lightbox__stage.is-zoomed')) return;
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
  // the image sits in its own pan box, so the prev/next arrows (stage children) stay put while it scrolls
  const pan = el('div', { class: 'lightbox__pan' });
  pan.append(img);
  // "Aqua says" while a large piece is still on its way (VISUAL-REFINEMENT-PLAN §7b)
  if (!img.complete) {
    const wait = aquaWait(say('いま持ってくるね……！', 'Bringing it over...!'));
    pan.append(wait);
    pan.classList.add('is-loading');
    img.addEventListener('load', () => (wait.remove(), pan.classList.remove('is-loading')), { once: true });
    img.addEventListener(
      'error',
      () => (wait.querySelector('p')!.textContent = say('あれ、開けなかった……', "Huh, it wouldn't open...")),
      { once: true },
    );
  }
  stage.append(pan);
  setupZoom(stage, pan, img);
  if (group.length > 1) {
    const prev = iconBtn('lightbox__nav lightbox__nav--prev', 'chevron', say('前の画像', 'Previous image'));
    (prev.firstElementChild as SVGElement).style.transform = 'scaleX(-1)';
    const next = iconBtn('lightbox__nav lightbox__nav--next', 'chevron', say('次の画像', 'Next image'));
    prev.addEventListener('click', (e) => (e.stopPropagation(), step(-1)));
    next.addEventListener('click', (e) => (e.stopPropagation(), step(1)));
    stage.append(prev, next);
    stage.append(filmstrip());
  }
  if (t.dataset.id) history.replaceState(history.state, '', `#art=${t.dataset.id}`);
}

/** Same markup as ui/AquaWait.astro: the small pose from --pose-wait and a speech bubble. */
function aquaWait(text: string) {
  const box = el('div', { class: 'aqua-wait lightbox__wait', role: 'status' });
  box.append(
    el('span', { class: 'aqua-wait__pose', 'aria-hidden': 'true' }),
    el('p', { class: 'aqua-wait__bubble' }, text),
  );
  return box;
}

/** A strip of the neighbouring pieces in the group along the bottom; click one to jump to it. */
function filmstrip() {
  const strip = el('div', {
    class: 'lightbox__strip',
    role: 'group',
    'aria-label': say('ほかの作品', 'More pieces'),
  });
  const span = 4;
  for (let d = -span; d <= span; d++) {
    const i = (index + d + group.length) % group.length;
    const tr = group[i]!;
    const src = tr.querySelector<HTMLImageElement>('img')?.currentSrc;
    if (!src || (d !== 0 && i === index)) continue;
    const b = el('button', {
      type: 'button',
      class: `lightbox__thumb${d === 0 ? ' is-current' : ''}`,
      'aria-label': tr.dataset.title || say('作品', 'Piece'),
      ...(d === 0 ? { 'aria-current': 'true' } : {}),
    });
    const im = el('img', { src, alt: '', loading: 'lazy', decoding: 'async' });
    b.append(im);
    b.addEventListener('click', (e) => {
      e.stopPropagation();
      if (d === 0) return;
      index = i;
      show(group[i]!);
    });
    strip.append(b);
  }
  return strip;
}

/**
 * Click to zoom in around the point you clicked (at least 2×, or the image's full resolution, up to 4×),
 * drag or scroll to look around, click again to zoom out.
 */
function setupZoom(stage: HTMLElement, pan: HTMLElement, img: HTMLImageElement) {
  let drag: { x: number; y: number; sl: number; st: number; moved: boolean } | null = null;
  const zoomIn = (cx: number, cy: number) => {
    const r = img.getBoundingClientRect();
    if (!r.width) return;
    const fx = (cx - r.left) / r.width;
    const fy = (cy - r.top) / r.height;
    const z = Math.min(4, Math.max(2, (img.naturalWidth || r.width) / r.width));
    stage.classList.add('is-zoomed');
    img.style.width = `${Math.round(r.width * z)}px`;
    const n = img.getBoundingClientRect(); // new layout: keep the clicked point under the pointer
    pan.scrollLeft += n.left + fx * n.width - cx;
    pan.scrollTop += n.top + fy * n.height - cy;
  };
  const zoomOut = () => {
    stage.classList.remove('is-zoomed');
    img.style.width = '';
    pan.scrollTo(0, 0);
  };
  // zoomed, a click anywhere in the pan box zooms out (unless it ended a drag); otherwise a click on
  // the image zooms in. Pointer capture starts only once a drag really moves, so plain clicks still land.
  pan.addEventListener('click', (e) => {
    const zoomed = stage.classList.contains('is-zoomed');
    if (!zoomed && e.target !== img) return; // empty space: the dialog's click-outside closes it
    e.stopPropagation();
    if (drag?.moved) return;
    if (zoomed) zoomOut();
    else zoomIn(e.clientX, e.clientY);
  });
  pan.addEventListener('pointerdown', (e) => {
    if (e.pointerType !== 'mouse' || e.button !== 0 || !stage.classList.contains('is-zoomed')) return;
    drag = { x: e.clientX, y: e.clientY, sl: pan.scrollLeft, st: pan.scrollTop, moved: false };
  });
  pan.addEventListener('pointermove', (e) => {
    if (!drag || !(e.buttons & 1)) return;
    const dx = e.clientX - drag.x;
    const dy = e.clientY - drag.y;
    if (!drag.moved && Math.abs(dx) + Math.abs(dy) > 4) {
      drag.moved = true;
      pan.setPointerCapture(e.pointerId);
    }
    if (!drag.moved) return;
    e.preventDefault();
    pan.scrollLeft = drag.sl - dx;
    pan.scrollTop = drag.st - dy;
  });
  const end = () => setTimeout(() => (drag = null), 0); // after the click that follows pointerup
  pan.addEventListener('pointerup', end);
  pan.addEventListener('pointercancel', end);
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
