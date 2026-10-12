/**
 * Cloudflare Turnstile (managed mode) for the composer and the report popover. The script loads on demand;
 * each widget hands out one single-use token, then resets itself.
 */
declare global {
  interface Window {
    turnstile?: {
      render: (el: HTMLElement, opts: Record<string, unknown>) => string;
      reset: (id: string) => void;
      remove: (id: string) => void;
    };
  }
}

let loader: Promise<void> | null = null;
function loadScript(): Promise<void> {
  if (window.turnstile) return Promise.resolve();
  loader ??= new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => {
      loader = null;
      reject(new Error('turnstile blocked'));
    };
    document.head.appendChild(s);
  });
  return loader;
}

export type Widget = { token: () => Promise<string>; reset: () => void; destroy: () => void };

export async function mountTurnstile(el: HTMLElement, siteKey: string, lang: 'ja' | 'en'): Promise<Widget> {
  await loadScript();
  let current: string | null = null;
  let waiters: ((t: string) => void)[] = [];
  const id = window.turnstile!.render(el, {
    sitekey: siteKey,
    appearance: 'interaction-only',
    language: lang,
    callback: (t: string) => {
      current = t;
      waiters.forEach((w) => w(t));
      waiters = [];
    },
    'expired-callback': () => {
      current = null;
      window.turnstile?.reset(id);
    },
    'error-callback': () => {
      current = null;
    },
  });
  return {
    token: () =>
      current
        ? Promise.resolve(current)
        : new Promise<string>((resolve, reject) => {
            waiters.push(resolve);
            setTimeout(() => reject(new Error('turnstile timeout')), 20_000);
          }),
    reset: () => {
      current = null;
      window.turnstile?.reset(id);
    },
    destroy: () => window.turnstile?.remove(id),
  };
}
