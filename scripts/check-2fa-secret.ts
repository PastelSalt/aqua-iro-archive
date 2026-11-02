/**
 * Read-only: can the BETTER_AUTH_SECRET in .env.production.local decrypt the stored two-factor data?
 * Better Auth encrypts the TOTP secret and the backup codes with BETTER_AUTH_SECRET, so if production's value
 * changed after enrolment, every code fails with "invalid tag" in the logs. Prints yes/no only, never a value.
 *   decrypts         → this is the secret 2FA was set up with: put it back as Production's BETTER_AUTH_SECRET
 *   DOES NOT decrypt → neither matches what's known: reset with scripts/reset-2fa.ts and enrol again
 */
import { eq } from 'drizzle-orm';
import { symmetricDecrypt } from 'better-auth/crypto';
import { scriptDb, loadProdEnv } from './lib/standalone-auth.ts';
import { twoFactor, user } from '../src/server/db/schema.ts';

loadProdEnv();
const { db, pool } = scriptDb();
const found = await db
  .select({ email: user.email, secret: twoFactor.secret, backup: twoFactor.backupCodes })
  .from(twoFactor)
  .innerJoin(user, eq(user.id, twoFactor.userId));
const check = async (data: string | null) => {
  if (!data) return 'empty';
  try {
    await symmetricDecrypt({ key: process.env.BETTER_AUTH_SECRET!, data });
    return 'decrypts';
  } catch {
    return 'DOES NOT decrypt';
  }
};
if (!found.length) console.log('No two-factor enrolment found.');
for (const r of found)
  console.log(
    `${r.email}: authenticator secret ${await check(r.secret)}, backup codes ${await check(r.backup)}`,
  );
await pool.end();
