/** Message Board settings with a 60 s in-memory cache per function instance (EXECUTIONPLAN §11.2). */
import { eq, sql } from 'drizzle-orm';
import { settings as settingsTable } from './db/schema';
import type { DB } from './db/types';

export const DEFAULTS = {
  report_threshold: 3,
  rereport_threshold: 6,
  posting_paused: false,
  newcomer_hold: false,
  rate_post_10m: 3,
  rate_post_day: 10,
  rate_report_hour: 20,
  raid_posts_5m: 40,
  max_len: 300,
  max_lines: 6,
  board_cache_s: 10,
} as const;
export type Settings = {
  -readonly [K in keyof typeof DEFAULTS]: (typeof DEFAULTS)[K] extends boolean ? boolean : number;
} & {
  newcomer_hold_auto_at?: string | null;
  last_cron_at?: string | null;
};
export type SettingKey = keyof typeof DEFAULTS;

let cache: { at: number; value: Settings } | null = null;
const TTL = 60_000;

export async function getSettings(db: DB, fresh = false): Promise<Settings> {
  if (!fresh && cache && Date.now() - cache.at < TTL) return cache.value;
  const rows = await db.select().from(settingsTable);
  const value = { ...DEFAULTS } as Settings;
  for (const r of rows) (value as Record<string, unknown>)[r.key] = r.value;
  cache = { at: Date.now(), value };
  return value;
}

export async function setSetting(db: DB, key: string, value: unknown): Promise<void> {
  if (value === null || value === undefined) {
    await db.delete(settingsTable).where(eq(settingsTable.key, key));
    cache = null;
    return;
  }
  await db
    .insert(settingsTable)
    .values({ key, value: value as never })
    .onConflictDoUpdate({ target: settingsTable.key, set: { value: value as never, updatedAt: sql`now()` } });
  cache = null;
}

export async function getSetting<T>(db: DB, key: string): Promise<T | undefined> {
  const [r] = await db.select().from(settingsTable).where(eq(settingsTable.key, key));
  return r?.value as T | undefined;
}

/** Validate a settings patch from the keeper UI. */
export function validateSetting(key: string, value: unknown): string | null {
  if (!(key in DEFAULTS)) return `unknown setting ${key}`;
  const d = DEFAULTS[key as SettingKey];
  if (typeof d === 'boolean') return typeof value === 'boolean' ? null : `${key} must be true or false`;
  if (typeof value !== 'number' || !Number.isInteger(value)) return `${key} must be a whole number`;
  const ranges: Partial<Record<SettingKey, [number, number]>> = {
    report_threshold: [1, 50],
    rereport_threshold: [1, 100],
    rate_post_10m: [1, 100],
    rate_post_day: [1, 1000],
    rate_report_hour: [1, 1000],
    raid_posts_5m: [5, 10000],
    max_len: [20, 300],
    max_lines: [1, 20],
    board_cache_s: [0, 300],
  };
  const r = ranges[key as SettingKey];
  if (r && (value < r[0] || value > r[1])) return `${key} must be between ${r[0]} and ${r[1]}`;
  return null;
}

export function _resetSettingsCache() {
  cache = null;
}
