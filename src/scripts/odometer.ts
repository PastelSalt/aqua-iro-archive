/**
 * Odometer trigger (components/ui/Odometer.astro): numbers roll the first time they come into view.
 * Only adds a class; the roll is a transform-only CSS animation. Motion OFF: nothing happens.
 */
import { onPage } from '../lib/lifecycle';

onPage(() => {
  if (document.documentElement.dataset.motion !== 'on' || !('IntersectionObserver' in window)) return;
  const els = Array.from(document.querySelectorAll<HTMLElement>('[data-odo]'));
  if (!els.length) return;
  const io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        io.unobserve(e.target);
        e.target.classList.add('is-rolling');
      }
    },
    { rootMargin: '0px 0px -10% 0px' },
  );
  els.forEach((el) => io.observe(el));
  return () => io.disconnect();
});
