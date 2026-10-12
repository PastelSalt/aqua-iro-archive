/** Browser helpers for /keeper: Better Auth client (with two-factor) + a toast. */
import { createAuthClient } from 'better-auth/client';
import { twoFactorClient } from 'better-auth/client/plugins';

export const authClient = createAuthClient({ basePath: '/api/auth', plugins: [twoFactorClient()] });
export const signOut = () => authClient.signOut();

let t: ReturnType<typeof setTimeout>;
export function toast(msg: string, undo?: () => void, ms = 5000) {
  const el = document.querySelector<HTMLElement>('[data-toast]');
  if (!el) return;
  el.innerHTML = '';
  el.append(document.createTextNode(msg));
  if (undo) {
    const b = document.createElement('button');
    b.className = 'k-btn';
    b.textContent = 'Undo';
    b.onclick = () => {
      undo();
      el.hidden = true;
    };
    el.append(b);
  }
  el.hidden = false;
  clearTimeout(t);
  t = setTimeout(() => (el.hidden = true), ms);
}
