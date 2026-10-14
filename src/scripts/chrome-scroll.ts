/**
 * One scroll reader for the decorative chrome (IMPROVEMENT-PLAN §1.4: one scroll listener):
 * - the side rail's running percentage,
 * - the logo tab's gentle swing (rotates with scroll speed, springs back when you stop).
 * Writes only to those two elements (transform / text), never to <html>, so nothing else restyles.
 */
let raf = 0;
let lastY = window.scrollY;
let lastT = performance.now();
let swing = 0;
let settle = 0;

const motionOn = () => document.documentElement.dataset.motion === 'on';

function frame() {
  raf = 0;
  const y = window.scrollY;
  const max = Math.max(1, document.documentElement.scrollHeight - innerHeight);
  const p = Math.min(1, Math.max(0, y / max));
  const pct = document.querySelector<HTMLElement>('.rail__progress');
  if (pct) pct.textContent = `${Math.round(p * 100)}%`;

  const now = performance.now();
  const v = (y - lastY) / Math.max(1, now - lastT); // px per ms
  lastY = y;
  lastT = now;
  const logo = document.querySelector<HTMLElement>('[data-logo-tab] img');
  if (logo && motionOn()) {
    swing = Math.max(-6, Math.min(6, swing * 0.6 + v * 2.2));
    logo.style.rotate = `${swing.toFixed(2)}deg`;
    clearTimeout(settle);
    settle = window.setTimeout(() => {
      swing = 0;
      logo.style.rotate = '0deg';
    }, 140);
  }
}

const onScroll = () => {
  if (!raf) raf = requestAnimationFrame(frame);
};
window.addEventListener('scroll', onScroll, { passive: true });
window.addEventListener('resize', onScroll, { passive: true });
document.addEventListener('astro:page-load', () => {
  lastY = window.scrollY;
  onScroll();
});

export {}; // a module, so its names stay private
