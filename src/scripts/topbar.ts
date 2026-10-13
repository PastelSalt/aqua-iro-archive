/**
 * Filter bars that dock beside the logo tab (Discography, Streaming, Arts).
 * In the page the bar sits centred in its section; once its slot scrolls under the top edge the bar
 * becomes fixed in the empty strip right of the logo tab (a FLIP slide when Motion is on), and slides
 * back when you scroll up past it. The slot keeps the bar's height so nothing below jumps.
 *
 * Markup: <div class="topbar-slot"><div data-topbar>…</div></div>
 */
import { onPage } from '../lib/lifecycle';

const DOCK_AT = 10; // dock once the slot's top passes this many px from the viewport top…
const UNDOCK_AT = 28; // …and undock only once it's back below this, so resting near the line can't flicker
const EASE = 'cubic-bezier(0.22, 1, 0.36, 1)';

function setup(bar: HTMLElement): () => void {
  const slot = bar.parentElement as HTMLElement;
  let docked = false;
  let raf = 0;
  let anim: Animation | null = null;

  const set = (to: boolean) => {
    anim?.cancel();
    const first = bar.getBoundingClientRect();
    if (to) slot.style.height = `${slot.offsetHeight}px`;
    bar.classList.toggle('is-docked', to);
    document.documentElement.classList.toggle('has-topbar', to);
    if (!to) slot.style.height = '';
    if (document.documentElement.dataset.motion !== 'on') return;
    const last = bar.getBoundingClientRect();
    const dx = first.left - last.left;
    const dy = first.top - last.top;
    const sx = first.width / Math.max(1, last.width);
    anim = bar.animate(
      [
        { transformOrigin: 'top left', transform: `translate(${dx}px, ${dy}px) scaleX(${sx})` },
        { transformOrigin: 'top left', transform: 'none' },
      ],
      { duration: 460, easing: EASE },
    );
  };

  const update = () => {
    raf = 0;
    const top = slot.getBoundingClientRect().top;
    const want = docked ? top < UNDOCK_AT : top < DOCK_AT;
    if (want !== docked) {
      docked = want;
      set(want);
    }
  };
  const onScroll = () => {
    if (!raf) raf = requestAnimationFrame(update);
  };
  update();
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll, { passive: true });
  return () => {
    window.removeEventListener('scroll', onScroll);
    window.removeEventListener('resize', onScroll);
    cancelAnimationFrame(raf);
    anim?.cancel();
    document.documentElement.classList.remove('has-topbar');
  };
}

onPage(() => {
  const bars = Array.from(document.querySelectorAll<HTMLElement>('.topbar-slot > [data-topbar]'));
  if (!bars.length) return;
  const cleanups = bars.map(setup);
  return () => cleanups.forEach((f) => f());
});
