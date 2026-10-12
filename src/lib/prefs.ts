/**
 * Visitor preferences as signals (motion, lang, bgm, shortcuts, splash). The pre-paint script in Base.astro
 * sets html[data-motion] / html[data-lang] before first paint; these signals take over after hydration.
 */
import { signal, effect } from '@preact/signals';
import { KEYS, read, write } from './storage';

export type Lang = 'ja' | 'en';
export type Prefs = {
  motion?: 'on' | 'off';
  lang?: Lang;
  bgm?: boolean;
  splash?: boolean;
  shortcuts?: boolean;
};

const isBrowser = typeof document !== 'undefined';
const html = () => document.documentElement;
const stored = read<Prefs>(KEYS.prefs, {});

export const motion = signal<'on' | 'off'>(
  isBrowser ? ((html().dataset.motion as 'on' | 'off') ?? 'on') : 'on',
);
export const lang = signal<Lang>(isBrowser ? ((html().dataset.lang as Lang) ?? 'ja') : 'ja');
export const bgmOn = signal<boolean>(false); // never autoplays; the capsule turns this on when ♪ is pressed
export const shortcuts = signal<boolean>(stored.shortcuts ?? true);

function save(patch: Partial<Prefs>) {
  write(KEYS.prefs, { ...read<Prefs>(KEYS.prefs, {}), ...patch });
}

if (isBrowser) {
  effect(() => {
    html().dataset.motion = motion.value;
    window.dispatchEvent(new CustomEvent('aia:motion', { detail: motion.value }));
  });
  effect(() => {
    html().dataset.lang = lang.value;
    html().lang = lang.value; // keep <html lang> in step with the language actually shown
  });
}

export function setMotion(v: 'on' | 'off') {
  motion.value = v;
  save({ motion: v });
}
export function toggleMotion() {
  setMotion(motion.value === 'on' ? 'off' : 'on');
}
export function setLang(v: Lang) {
  lang.value = v;
  save({ lang: v });
}
export function toggleLang() {
  setLang(lang.value === 'ja' ? 'en' : 'ja');
}
export function setShortcuts(v: boolean) {
  shortcuts.value = v;
  save({ shortcuts: v });
}
export function markSplashSeen() {
  save({ splash: true });
  if (isBrowser) {
    html().dataset.splash = 'seen';
    window.dispatchEvent(new Event('aia:splash-seen'));
  }
}
/** For non-Preact scripts: is motion currently allowed? */
export function motionOn(): boolean {
  return isBrowser && html().dataset.motion === 'on';
}

// ClientRouter copies <html> attributes from the incoming document, which drops data-motion / data-lang.
// Re-apply from the signals after every swap (works even when storage is blocked).
if (isBrowser) {
  let splashSeen = html().dataset.splash === 'seen';
  document.addEventListener('astro:after-swap', () => {
    html().dataset.motion = motion.value;
    html().dataset.lang = lang.value;
    html().lang = lang.value;
    if (splashSeen || read<Prefs>(KEYS.prefs, {}).splash) html().dataset.splash = 'seen';
  });
  window.addEventListener('aia:splash-seen', () => (splashSeen = true));
}
