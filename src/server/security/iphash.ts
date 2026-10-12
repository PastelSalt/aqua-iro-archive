/**
 * IP hash (EXECUTIONPLAN §12.4 step 7): HMAC-SHA256(secret, "YYYYMM|ip") → first 32 hex chars.
 * The monthly component makes this month's hashes unlinkable to last month's. Raw IPs are never stored.
 */
import { createHash, createHmac } from 'node:crypto';

export function monthKey(d = new Date()): string {
  return `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

export function ipHash(secret: string, ip: string, now = new Date()): string {
  if (!secret) throw new Error('IP_HASH_SECRET is not set');
  return createHmac('sha256', secret)
    .update(`${monthKey(now)}|${ip.trim().toLowerCase()}`)
    .digest('hex')
    .slice(0, 32);
}

export function sha256(s: string): string {
  return createHash('sha256').update(s).digest('hex');
}
