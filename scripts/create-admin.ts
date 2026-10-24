/**
 * One-time admin creation (EXECUTIONPLAN §15.1). Run locally against production, with the production values
 * in .env.production.local (loaded and checked by loadProdEnv):
 *   npm run admin:create -- you@example.com
 * The passphrase is typed in (never stored in a file). The app itself never allows sign-up.
 * After the first sign-in, /keeper forces TOTP enrollment.
 */
import { scriptAuth, scriptDb, askHidden, loadProdEnv } from './lib/standalone-auth.ts';

loadProdEnv();
const email = process.argv[2] ?? process.env.ADMIN_EMAIL;
if (!email) throw new Error('Pass the email: npm run admin:create -- you@example.com');
const { db, pool } = scriptDb();
const pass = await askHidden(`Passphrase for ${email} (14+ chars): `);
if (pass.length < 14) throw new Error('Passphrase must be at least 14 characters');
if ((await askHidden('Repeat passphrase: ')) !== pass) throw new Error('Passphrases do not match');
const auth = scriptAuth(db, true);
await auth.api.signUpEmail({ body: { email, password: pass, name: 'Keeper' } });
console.log(`✓ Admin ${email} created. Sign in at /keeper/login and set up two-factor.`);
await pool.end();
