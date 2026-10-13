/**
 * Scroll reveal (Motion ON only): cards and section titles float up as they enter the viewport,
 * staggered when several arrive together. Anything already on screen when the page loads is left
 * alone so nothing flashes. The reveal uses its own keyframes (translate / scale / opacity), and the
 * hook is removed once it has played so each element's own transitions and hover effects come back.
 */
import { onPage } from '../lib/lifecycle';

const SELECTOR = [
  '.sec-title',
  '.spread__item',
  '.farewell__body',
  '.id-card',
  '.scrap',
  '.relmap',
  '.rel-list__item',
  '.wardrobe__item',
  '.link-tags',
  '.clip',
  '.jacket',
  '.ruler',
  '.trophy',
  '.yearbars',
  '.heatmap',
  '.art-tile',
  '.art-banner',
  '.ribbon-tag',
  '.rel-card',
  '.lighthouse',
  '.credit-group',
  '.board',
  '.compose',
  '.related__card',
  '.footer__inner > *',
  '.maker-card',
].join(',');

onPage(() => {
  if (document.documentElement.dataset.motion !== 'on' || !('IntersectionObserver' in window)) return;
  const els = Array.from(document.querySelectorAll<HTMLElement>(SELECTOR)).filter(
    // (not inside hidden tabs/panels either: those appear instantly when switched to, as before)
    (el) => !el.closest('[data-topbar], .drawer, .tour, [hidden]'),
  );
  if (!els.length) return;
  const done = (el: HTMLElement) => {
    delete el.dataset.reveal;
    el.classList.remove('is-in');
    el.style.removeProperty('--rd');
  };
  // No getBoundingClientRect here: measuring every candidate at load forces a full layout (and lays
  // out content-visibility sections early). The observer's first report per element tells us instead:
  // anything already on screen is left alone; the rest is hidden (it is off screen, so nothing flashes)
  // and floats in when it arrives.
  const seen = new WeakSet<Element>();
  const io = new IntersectionObserver((entries) => {
    let n = 0;
    for (const e of entries) {
      const el = e.target as HTMLElement;
      if (!seen.has(el)) {
        seen.add(el);
        if (e.isIntersecting) {
          io.unobserve(el);
          continue;
        }
        el.dataset.reveal = '';
        continue;
      }
      if (!e.isIntersecting) continue;
      io.unobserve(el);
      el.style.setProperty('--rd', `${Math.min(n++, 8) * 80}ms`);
      el.classList.add('is-in');
      el.addEventListener('animationend', () => done(el), { once: true });
    }
  });
  els.forEach((el) => io.observe(el));
  return () => {
    io.disconnect();
    els.forEach(done);
  };
});
