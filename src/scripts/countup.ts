/**
 * Count-up (IMPROVEMENT-PLAN §1.5): elements with [data-countup] tick from 0 to their number the first
 * time they come into view, then show their exact original text again.
 *   <span data-countup data-to="5280000">528万回</span>     (data-prefix="#" for ranks)
 * Intermediate frames are shown compactly (5.3M / 528万); Motion OFF leaves the text untouched.
 */
import { onPage } from '../lib/lifecycle';

const ja = (n: number) =>
  n >= 1e8 ? `${(n / 1e8).toFixed(1)}億` : n >= 1e4 ? `${Math.round(n / 1e4)}万` : `${Math.round(n)}`;
const en = (n: number) =>
  n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `${(n / 1e3).toFixed(0)}K` : `${Math.round(n)}`;

function run(el: HTMLElement) {
  const to = Number(el.dataset.to);
  if (!Number.isFinite(to) || to <= 0) return;
  const original = el.textContent ?? '';
  const prefix = el.dataset.prefix ?? '';
  const lang = el.closest('[lang]')?.getAttribute('lang') === 'ja' ? 'ja' : 'en';
  const suffix = /回\s*$/.test(original) ? '回' : / views\s*$/.test(original) ? ' views' : '';
  const fmt = to < 1000 ? (n: number) => `${Math.round(n)}` : lang === 'ja' ? ja : en;
  const dur = Math.min(1400, 500 + Math.log10(to) * 120);
  const t0 = performance.now();
  const step = (t: number) => {
    const k = Math.min(1, (t - t0) / dur);
    const eased = 1 - (1 - k) ** 3;
    if (k < 1) {
      el.textContent = `${prefix}${fmt(Math.max(to < 1000 ? 1 : 0, to * eased))}${suffix}`;
      requestAnimationFrame(step);
    } else el.textContent = original;
  };
  requestAnimationFrame(step);
}

onPage(() => {
  if (document.documentElement.dataset.motion !== 'on' || !('IntersectionObserver' in window)) return;
  const els = Array.from(document.querySelectorAll<HTMLElement>('[data-countup]'));
  if (!els.length) return;
  const io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        io.unobserve(e.target);
        run(e.target as HTMLElement);
      }
    },
    { rootMargin: '0px 0px -10% 0px' },
  );
  els.forEach((el) => io.observe(el));
  return () => io.disconnect();
});
