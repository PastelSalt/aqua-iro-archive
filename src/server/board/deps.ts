/** Build BoardDeps from the typed env (astro:env) and the request. Only on-demand routes import this. */
import { IP_HASH_SECRET, TURNSTILE_SECRET_KEY, DISCORD_WEBHOOK_URL } from 'astro:env/server';
import { db } from '../db/http';
import type { BoardDeps } from './types';

const SITE = import.meta.env.SITE ?? 'https://aqua-iro-archive.vercel.app';

export function boardDeps(clientIp: string): BoardDeps {
  if (!IP_HASH_SECRET) throw new Error('IP_HASH_SECRET is not set');
  const host = new URL(SITE).hostname;
  return {
    db: db(),
    ipSecret: IP_HASH_SECRET,
    turnstileSecret: TURNSTILE_SECRET_KEY ?? '',
    hostnames: [host, 'localhost'],
    clientIp: clientIp || '0.0.0.0',
    discordWebhook: DISCORD_WEBHOOK_URL,
    siteUrl: SITE.replace(/\/$/, ''),
  };
}
