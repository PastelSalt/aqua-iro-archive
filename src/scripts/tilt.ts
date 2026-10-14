/**
 * Hover tilt (IMPROVEMENT-PLAN §1.5): elements marked [data-tilt] lean toward the pointer in 3D (±8°)
 * with a glare that follows it. One delegated listener; mouse/pen only; Motion OFF leaves them flat.
 */
let current: HTMLElement | null = null;
let raf = 0;
let last: PointerEvent | null = null;

function apply() {
  raf = 0;
  if (!current || !last) return;
  const r = current.getBoundingClientRect();
  const x = (last.clientX - r.left) / r.width;
  const y = (last.clientY - r.top) / r.height;
  current.style.setProperty('--ry', `${((x - 0.5) * 16).toFixed(1)}deg`);
  current.style.setProperty('--rx', `${((0.5 - y) * 16).toFixed(1)}deg`);
  current.style.setProperty('--gx', `${(x * 100).toFixed(0)}%`);
  current.style.setProperty('--gy', `${(y * 100).toFixed(0)}%`);
}
function reset(el: HTMLElement) {
  for (const p of ['--rx', '--ry', '--gx', '--gy']) el.style.removeProperty(p);
  el.classList.remove('is-tilting');
}

document.addEventListener(
  'pointermove',
  (e) => {
    if (e.pointerType === 'touch' || document.documentElement.dataset.motion !== 'on') return;
    const el = (e.target as HTMLElement).closest?.<HTMLElement>('[data-tilt]') ?? null;
    if (el !== current) {
      if (current) reset(current);
      current = el;
      current?.classList.add('is-tilting');
    }
    last = e;
    if (current && !raf) raf = requestAnimationFrame(apply);
  },
  { passive: true },
);
document.addEventListener('astro:before-swap', () => {
  if (current) reset(current);
  current = null;
});

export {}; // a module, so its names stay private
