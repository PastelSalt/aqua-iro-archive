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

/** Thrown by token(): `turnstile:<Cloudflare error code>`, `turnstile:timeout` or `turnstile:expired`. */
export const isTurnstileError = (e: unknown) => e instanceof Error && e.message.startsWith('turnstile');

export async function mountTurnstile(el: HTMLElement, siteKey: string, lang: 'ja' | 'en'): Promise<Widget> {
  await loadScript();
  let current: string | null = null;
  let waiters: { resolve: (t: string) => void; reject: (e: Error) => void }[] = [];
  const settle = (t: string | Error) => {
    for (const w of waiters) {
      if (typeof t === 'string') w.resolve(t);
      else w.reject(t);
    }
    waiters = [];
  };
  let retry: ReturnType<typeof setTimeout> | undefined;
  const id = window.turnstile!.render(el, {
    sitekey: siteKey,
    appearance: 'interaction-only',
    language: lang,
    retry: 'auto',
    'refresh-expired': 'auto',
    callback: (t: string) => {
      current = t;
      settle(t);
    },
    'expired-callback': () => {
      current = null;
    },
    // a failed challenge used to leave the widget dead and the post waiting 20 s for a token that never came:
    // fail the waiting post now with Cloudflare's code, then try again in the background
    'error-callback': (code: string) => {
      current = null;
      settle(new Error(`turnstile:${code || 'error'}`));
      clearTimeout(retry);
      retry = setTimeout(() => window.turnstile?.reset(id), 3000);
      return true; // handled: no console noise from Cloudflare's script
    },
    'timeout-callback': () => {
      current = null;
      window.turnstile?.reset(id);
    },
  });
  return {
    token: () =>
      current
        ? Promise.resolve(current)
        : new Promise<string>((resolve, reject) => {
            const w = { resolve, reject };
            waiters.push(w);
            setTimeout(() => {
              waiters = waiters.filter((x) => x !== w);
              reject(new Error('turnstile:timeout'));
            }, 20_000);
          }),
    reset: () => {
      current = null;
      window.turnstile?.reset(id);
    },
    destroy: () => {
      clearTimeout(retry);
      window.turnstile?.remove(id);
    },
  };
}
