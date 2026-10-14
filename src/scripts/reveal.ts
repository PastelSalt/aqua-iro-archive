/**
 * Scroll reveal (Motion ON only): section titles and section-level blocks float up as they enter the
 * viewport (single cards and tiles don't — on 190-tile galleries that left gaps while scrolling),
 * staggered when several arrive together. Anything already on screen when the page loads is left
 * alone so nothing flashes. The reveal uses its own keyframes (translate / scale / opacity), and the
 * hook is removed once it has played so each element's own transitions and hover effects come back.
 */
import { onPage } from '../lib/lifecycle';

const SELECTOR = [
  '.sec-title',
  '.farewell__body',
  '.id-card',
  '.scrap',
  '.relmap',
  '.link-tags',
  '.ruler',
  '.yearbars',
  '.art-banner',
  '.rel-card',
  '.lighthouse',
  '.credit-group',
  '.board',
  '.compose',
  '.related__card',
  '.footer__inner > *',
  '.maker-card',
  '.sticker',
  '.stamp',
  '.postcard',
  '.spread__item',
  '.jacket',
  '.bside',
  '.ev',
  '.port__year',
  '.ending__sign',
  '.farewell__sign',
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
  // start a little before arrival so the reveal is done by the time you're looking at it
  const io = new IntersectionObserver(
    (entries) => {
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
        el.style.setProperty('--rd', `${Math.min(n++, 3) * 80}ms`);
        el.classList.add('is-in');
        el.addEventListener('animationend', () => done(el), { once: true });
      }
    },
    { rootMargin: '0px 0px 15% 0px' },
  );
  els.forEach((el) => io.observe(el));
  return () => {
    io.disconnect();
    els.forEach(done);
  };
});
