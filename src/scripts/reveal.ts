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
  const fold = window.innerHeight * 0.92;
  const els = Array.from(document.querySelectorAll<HTMLElement>(SELECTOR)).filter(
    (el) => !el.closest('[data-topbar], .drawer, .tour') && el.getBoundingClientRect().top > fold,
  );
  if (!els.length) return;
  const done = (el: HTMLElement) => {
    delete el.dataset.reveal;
    el.classList.remove('is-in');
    el.style.removeProperty('--rd');
  };
  const io = new IntersectionObserver(
    (entries) => {
      let n = 0;
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        const el = e.target as HTMLElement;
        io.unobserve(el);
        el.style.setProperty('--rd', `${Math.min(n++, 8) * 80}ms`);
        el.classList.add('is-in');
        el.addEventListener('animationend', () => done(el), { once: true });
      }
    },
    { rootMargin: '0px 0px -6% 0px' },
  );
  for (const el of els) {
    el.dataset.reveal = '';
    io.observe(el);
  }
  return () => {
    io.disconnect();
    els.forEach(done);
  };
});
