/**
 * Filter bars that dock at the top (Discography, Streaming, Arts) — one shared pattern.
 * In the page the bar sits in its section. Once its slot scrolls under the top edge, and while its
 * section is still on screen, it becomes a single fixed row: right of the logo tab on desktop, under
 * it on phones. The row holds the primary control (tabs / years / sections), which scrolls sideways
 * with faded edges; secondary controls (search, sort, view, tags) open from the Filters button. When
 * the section has scrolled past, or you scroll back above the slot, the bar slides back.
 *
 * Markup: <div class="topbar-slot"><div data-topbar>
 *           <… data-topbar-primary> <button data-topbar-more> <… data-topbar-secondary>…
 *         </div></div>
 */
import { onPage } from '../lib/lifecycle';

const DOCK_AT = 10; // dock once the slot's top passes this many px from the viewport top…
const UNDOCK_AT = 28; // …and undock only once it's back below this, so resting near the line can't flicker
const EASE = 'cubic-bezier(0.22, 1, 0.36, 1)';
const PHONE = '(max-width: 760px)';

function setup(bar: HTMLElement): () => void {
  const slot = bar.parentElement as HTMLElement;
  // the content the bar filters: its section, or (Arts) the gallery right after the slot
  const scope = (slot.closest('section') ?? slot.nextElementSibling ?? slot) as HTMLElement;
  const primary = bar.querySelector<HTMLElement>('[data-topbar-primary]');
  const more = bar.querySelector<HTMLButtonElement>('[data-topbar-more]');
  let docked = false;
  let raf = 0;
  let anim: Animation | null = null;

  const setOpen = (open: boolean) => {
    bar.classList.toggle('is-open', open);
    more?.setAttribute('aria-expanded', String(open));
  };
  // faded edges only where there is more to scroll to
  const fades = () => {
    if (!primary) return;
    const max = primary.scrollWidth - primary.clientWidth;
    primary.classList.toggle('fade-l', docked && primary.scrollLeft > 2);
    primary.classList.toggle('fade-r', docked && primary.scrollLeft < max - 2);
  };
  const place = () => {
    // phones: under the (shrunken) logo tab instead of hiding it
    const logo = document.querySelector<HTMLElement>('.logo-tab');
    if (matchMedia(PHONE).matches && logo)
      bar.style.setProperty('--topbar-top', `${Math.round(logo.offsetHeight * 0.7) + 8}px`);
    else bar.style.removeProperty('--topbar-top');
  };

  const set = (to: boolean) => {
    anim?.cancel();
    const first = bar.getBoundingClientRect();
    if (to) {
      place();
      slot.style.height = `${slot.offsetHeight}px`;
    } else setOpen(false);
    bar.classList.toggle('is-docked', to);
    document.documentElement.classList.toggle('has-topbar', to);
    if (!to) slot.style.height = '';
    fades();
    if (document.documentElement.dataset.motion !== 'on') return;
    const last = bar.getBoundingClientRect();
    anim = bar.animate(
      [
        {
          transformOrigin: 'top left',
          transform: `translate(${first.left - last.left}px, ${first.top - last.top}px) scaleX(${first.width / Math.max(1, last.width)})`,
          opacity: to ? 1 : 0.6,
        },
        { transformOrigin: 'top left', transform: 'none', opacity: 1 },
      ],
      { duration: 420, easing: EASE },
    );
  };

  const update = () => {
    raf = 0;
    const top = slot.getBoundingClientRect().top;
    const end = scope.getBoundingClientRect().bottom;
    const room = bar.offsetHeight + (docked ? 40 : 120); // undock before the section's end reaches the bar
    const want = (docked ? top < UNDOCK_AT : top < DOCK_AT) && end > room;
    if (want !== docked) {
      docked = want;
      set(want);
    }
  };
  const onScroll = () => {
    if (!raf) raf = requestAnimationFrame(update);
  };
  const onMore = () => setOpen(!bar.classList.contains('is-open'));
  const onKey = (e: KeyboardEvent) =>
    e.key === 'Escape' && bar.classList.contains('is-open') && setOpen(false);
  update();
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll, { passive: true });
  primary?.addEventListener('scroll', fades, { passive: true });
  more?.addEventListener('click', onMore);
  bar.addEventListener('keydown', onKey);
  return () => {
    window.removeEventListener('scroll', onScroll);
    window.removeEventListener('resize', onScroll);
    primary?.removeEventListener('scroll', fades);
    more?.removeEventListener('click', onMore);
    bar.removeEventListener('keydown', onKey);
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
