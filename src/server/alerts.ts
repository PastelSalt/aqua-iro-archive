/**
 * Discord webhook alerts (EXECUTIONPLAN §15.6). Sent with waitUntil so the visitor's request never waits.
 * Messages carry crew number, status and reason only — never the note text (Discord is a third party).
 */
import { waitUntil } from '@vercel/functions';

export async function sendAlert(webhook: string | undefined, content: string): Promise<void> {
  if (!webhook) return;
  try {
    await fetch(webhook, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: content.slice(0, 1900), allowed_mentions: { parse: [] } }),
      signal: AbortSignal.timeout(5000),
    });
  } catch {
    /* alerts are best-effort */
  }
}

export function alertLater(webhook: string | undefined, content: string): void {
  const p = sendAlert(webhook, content);
  try {
    waitUntil(p);
  } catch {
    void p; // outside Vercel (tests, local): just let it run
  }
}
