/** Cloudflare Turnstile server-side validation (EXECUTIONPLAN §12.4 step 3). Tokens are single-use, valid 300 s. */
import { randomUUID } from 'node:crypto';

const ENDPOINT = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';
/** Cloudflare's documented testing secrets (always pass / always fail / token already spent). */
const TEST_SECRETS = new Set([
  '1x0000000000000000000000000000000AA',
  '2x0000000000000000000000000000000AA',
  '3x0000000000000000000000000000000AA',
]);

export async function verifyTurnstile(opts: {
  secret: string;
  token: string;
  ip?: string;
  hostnames?: string[];
  fetchImpl?: typeof fetch;
}): Promise<{ ok: boolean; codes: string[] }> {
  if (!opts.secret) return { ok: false, codes: ['missing-secret'] };
  if (!opts.token) return { ok: false, codes: ['missing-input-response'] };
  const body = new URLSearchParams({
    secret: opts.secret,
    response: opts.token,
    idempotency_key: randomUUID(),
  });
  if (opts.ip) body.set('remoteip', opts.ip);
  try {
    const res = await (opts.fetchImpl ?? fetch)(ENDPOINT, {
      method: 'POST',
      body,
      signal: AbortSignal.timeout(5000),
    });
    const data = (await res.json()) as { success: boolean; hostname?: string; 'error-codes'?: string[] };
    if (!data.success) return { ok: false, codes: data['error-codes'] ?? [] };
    // the testing secrets answer with a placeholder hostname, so only check real ones
    if (
      !TEST_SECRETS.has(opts.secret) &&
      opts.hostnames?.length &&
      data.hostname &&
      !opts.hostnames.includes(data.hostname)
    )
      return { ok: false, codes: ['hostname-mismatch'] };
    return { ok: true, codes: [] };
  } catch {
    return { ok: false, codes: ['network'] };
  }
}
