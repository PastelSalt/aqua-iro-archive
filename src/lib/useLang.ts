/**
 * The language an island should render with. Preact's hydration keeps the server's attributes
 * (aria-labels, titles), and islands are server-rendered in Japanese, so the first client render
 * uses 'ja' to match that HTML and the next one switches to the visitor's language, which makes
 * Preact patch every label that differs.
 */
import { useEffect, useState } from 'preact/hooks';
import { lang, type Lang } from './prefs';

export function useLang(): Lang {
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  return ready ? lang.value : 'ja';
}
