/** Error log (EXECUTIONPLAN §24.5): Vercel Hobby keeps runtime logs for 1 h, so errors also go to app_errors. */
import { appErrors } from './db/schema';
import type { DB } from './db/types';

export async function logError(
  db: DB | null,
  route: string,
  err: unknown,
  meta?: Record<string, unknown>,
): Promise<void> {
  const e = err instanceof Error ? err : new Error(String(err));
  console.error(`[${route}]`, e);
  if (!db) return;
  try {
    await db.insert(appErrors).values({
      route,
      message: e.message.slice(0, 2000),
      stack: e.stack?.slice(0, 8000) ?? null,
      meta: meta ?? null,
    });
  } catch {
    /* never throw from the logger */
  }
}
