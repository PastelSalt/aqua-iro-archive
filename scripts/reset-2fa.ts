/** Runbook §25.5: disable 2FA for the admin when backup codes are lost. Writes an audit row; re-enroll afterwards. */
import { eq, sql } from 'drizzle-orm';
import { scriptDb, loadProdEnv } from './lib/standalone-auth.ts';
import { user, twoFactor } from '../src/server/db/schema.ts';

loadProdEnv();
const email = process.argv[2] ?? process.env.ADMIN_EMAIL;
if (!email) throw new Error('Pass the email: npx tsx scripts/reset-2fa.ts you@example.com');
const { db, pool } = scriptDb();
const [u] = await db.select().from(user).where(eq(user.email, email));
if (!u) throw new Error(`No user ${email}`);
await db.delete(twoFactor).where(eq(twoFactor.userId, u.id));
await db.update(user).set({ twoFactorEnabled: false }).where(eq(user.id, u.id));
await db.execute(
  sql`INSERT INTO admin_actions (actor_id, action, detail) VALUES (${u.id}, 'twofa_reset', ${JSON.stringify({ by: 'script' })}::jsonb)`,
);
if (process.env.DISCORD_WEBHOOK_URL)
  await fetch(process.env.DISCORD_WEBHOOK_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content: '🔐 Keeper two-factor was reset from the command line' }),
  });
console.log('✓ Two-factor reset. Sign in and enroll again.');
await pool.end();
