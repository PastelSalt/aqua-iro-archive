/** Site-wide behaviors: outbound-link analytics and Core Web Vitals → Umami (EXECUTIONPLAN §16). */
import { track } from '../lib/analytics';
import './topbar';
import './reveal';
import './sparkle';
import './offscreen';

// Japanese webfonts load without blocking first paint (system fonts show until they swap in).
for (const l of document.querySelectorAll<HTMLLinkElement>('link[data-jp-fonts]')) l.media = 'all';
document.addEventListener('astro:after-swap', () => {
  for (const l of document.querySelectorAll<HTMLLinkElement>('link[data-jp-fonts]')) l.media = 'all';
});

document.addEventListener(
  'click',
  (e) => {
    const a = (e.target as HTMLElement).closest?.('a[href]') as HTMLAnchorElement | null;
    if (!a || a.dataset.lb) return;
    try {
      const u = new URL(a.href, location.href);
      if (u.origin !== location.origin && /^https?:$/.test(u.protocol))
        track('outbound', { host: u.hostname });
    } catch {
      /* ignore */
    }
  },
  { capture: true },
);

// Core Web Vitals, one event per metric per page view; only if the tracker is present
const startVitals = () => {
  if (!window.umami) return;
  import('web-vitals').then(({ onLCP, onINP, onCLS, onFCP, onTTFB }) => {
    const send = (m: { name: string; rating: string }) =>
      track('cwv', { name: m.name, rating: m.rating, page: location.pathname });
    onLCP(send);
    onINP(send);
    onCLS(send);
    onFCP(send);
    onTTFB(send);
  });
};
if ('requestIdleCallback' in window) requestIdleCallback(() => setTimeout(startVitals, 1500));
else setTimeout(startVitals, 3000);
