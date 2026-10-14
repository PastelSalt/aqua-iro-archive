/**
 * Pause looping decoration while it is scrolled out of view: zones get [data-offscreen] (motion.css
 * pauses every animation inside). Nothing visible changes — it only stops the compositor from ticking
 * animations nobody can see. (The Home bubble canvas pauses itself the same way, in bubbles.ts.)
 */
import { onPage } from '../lib/lifecycle';

const ZONES = '.home-hero, .marquee, .page-head, .lighthouse, .farewell, .stamp, .seam, .ending, .postcard';

onPage(() => {
  if (!('IntersectionObserver' in window)) return;
  const io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        const el = e.target as HTMLElement;
        if (e.isIntersecting) delete el.dataset.offscreen;
        else el.dataset.offscreen = '';
      }
    },
    { rootMargin: '120px 0px' },
  );
  const zones = Array.from(document.querySelectorAll<HTMLElement>(ZONES));
  zones.forEach((z) => io.observe(z));
  return () => io.disconnect();
});
