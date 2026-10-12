/**
 * ClientRouter lifecycle (EXECUTIONPLAN §7.1): module scripts run once, so every page module
 * registers init/destroy here. `init` runs on every astro:page-load (including the first) and must
 * bail out when its root element isn't on the current page; its cleanup runs on astro:before-swap.
 */
type Cleanup = void | (() => void);

export function onPage(init: () => Cleanup): void {
  let cleanup: Cleanup;
  const stop = () => {
    try {
      cleanup?.();
    } finally {
      cleanup = undefined;
    }
  };
  document.addEventListener('astro:page-load', () => {
    stop();
    cleanup = init();
  });
  document.addEventListener('astro:before-swap', stop);
}

/** Run `fn` now and whenever Motion is toggled; returns an unsubscribe. */
export function onMotion(fn: (on: boolean) => void): () => void {
  const h = () => fn(document.documentElement.dataset.motion === 'on');
  h();
  window.addEventListener('aia:motion', h);
  return () => window.removeEventListener('aia:motion', h);
}
