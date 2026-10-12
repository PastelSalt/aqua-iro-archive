/**
 * Umami API client for /keeper (EXECUTIONPLAN §15.4). Token cached 12 h; responses cached 5 min per range.
 * Endpoint shapes are isolated here so a version change touches one file — verify paths against the installed
 * Umami version when it is deployed (Umami v3: metrics type `path` instead of v2's `url`).
 */
import { UMAMI_API_URL, UMAMI_API_USER, UMAMI_API_PASSWORD } from 'astro:env/server';
import { PUBLIC_UMAMI_WEBSITE_ID } from 'astro:env/client';

let token: { value: string; at: number } | null = null;
const cache = new Map<string, { at: number; data: unknown }>();

export function umamiConfigured(): boolean {
  return !!(UMAMI_API_URL && UMAMI_API_USER && UMAMI_API_PASSWORD && PUBLIC_UMAMI_WEBSITE_ID);
}

async function login(): Promise<string> {
  if (token && Date.now() - token.at < 12 * 3600_000) return token.value;
  const r = await fetch(`${UMAMI_API_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: UMAMI_API_USER, password: UMAMI_API_PASSWORD }),
    signal: AbortSignal.timeout(6000),
  });
  if (!r.ok) throw new Error(`umami login ${r.status}`);
  token = { value: ((await r.json()) as { token: string }).token, at: Date.now() };
  return token.value;
}

async function get<T>(path: string, params: Record<string, string | number>, retry = true): Promise<T> {
  const key = `${path}?${new URLSearchParams(params as Record<string, string>)}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < 5 * 60_000) return hit.data as T;
  const r = await fetch(`${UMAMI_API_URL}/websites/${PUBLIC_UMAMI_WEBSITE_ID}${key}`, {
    headers: { Authorization: `Bearer ${await login()}` },
    signal: AbortSignal.timeout(8000),
  });
  if (r.status === 401 && retry) {
    token = null;
    return get(path, params, false);
  }
  if (!r.ok) throw new Error(`umami ${path} ${r.status}`);
  const data = (await r.json()) as T;
  cache.set(key, { at: Date.now(), data });
  return data;
}

export type Range = { startAt: number; endAt: number };
export function rangeFor(id: string): Range {
  const endAt = Date.now();
  const days = id === '24h' ? 1 : id === '7d' ? 7 : id === '30d' ? 30 : id === '90d' ? 90 : 3650;
  return { startAt: endAt - days * 86400_000, endAt };
}

export async function overview(range: Range) {
  const base = { ...range, timezone: 'Asia/Manila' };
  const metric = (type: string) =>
    get<{ x: string; y: number }[]>('/metrics', { ...base, type, limit: 10 }).catch(() => []);
  const [stats, pageviews, paths, referrers, countries, devices, browsers, events] = await Promise.all([
    get<Record<string, { value: number } | number>>('/stats', base),
    get<{ pageviews: { x: string; y: number }[]; sessions: { x: string; y: number }[] }>('/pageviews', {
      ...base,
      unit: 'day',
    }),
    metric('path').then((r) => (r.length ? r : metric('url'))),
    metric('referrer'),
    metric('country'),
    metric('device'),
    metric('browser'),
    metric('event'),
  ]);
  return { stats, pageviews, paths, referrers, countries, devices, browsers, events, fetchedAt: Date.now() };
}

export async function eventProperty(range: Range, event: string, property: string) {
  return get<{ value: string; total: number }[]>('/event-data/values', {
    ...range,
    event,
    propertyName: property,
  }).catch(() => []);
}

export async function umamiVisitors24h(): Promise<number | null> {
  if (!umamiConfigured()) return null;
  const s = await get<Record<string, { value: number } | number>>('/stats', {
    ...rangeFor('24h'),
    timezone: 'Asia/Manila',
  });
  const v = s.visitors;
  return typeof v === 'number' ? v : (v?.value ?? null);
}
