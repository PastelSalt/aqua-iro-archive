/**
 * "Don't count this browser" (Keeper → My account), shared by the tracker (src/lib/analytics.ts) and the Keeper
 * without loading the tracker there. The flag lives in this site's localStorage, so it covers every page.
 */
export const OPT_OUT_KEY = 'aia-no-count';

export function isOptedOut(): boolean {
  try {
    return localStorage.getItem(OPT_OUT_KEY) === '1';
  } catch {
    return false;
  }
}
export function setOptedOut(out: boolean): boolean {
  try {
    if (out) localStorage.setItem(OPT_OUT_KEY, '1');
    else localStorage.removeItem(OPT_OUT_KEY);
    return true;
  } catch {
    return false; // storage blocked (private mode): nothing to remember
  }
}
