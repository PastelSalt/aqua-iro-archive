/**
 * Single-admin auth for /keeper (EXECUTIONPLAN §15.1): email + password, sign-up disabled, mandatory TOTP
 * (enforced in middleware), database-backed rate limits, new-login and failed-login alerts.
 * Option names checked against better-auth 1.7.7 types on 2026-10-12.
 */
import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { twoFactor } from 'better-auth/plugins';
import { createAuthMiddleware } from 'better-auth/api';
import { sql } from 'drizzle-orm';
import { BETTER_AUTH_SECRET, BETTER_AUTH_URL, DISCORD_WEBHOOK_URL } from 'astro:env/server';
import { dbTx } from './db/pool';
import * as schema from './db/schema';
import { rows } from './db/types';
import { alertLater } from './alerts';

const SITE = (import.meta.env.SITE ?? 'https://aqua-iro-archive.vercel.app').replace(/\/$/, '');

export function authOptions(opts: { allowSignUp?: boolean } = {}) {
  const db = dbTx();
  return {
    appName: 'Aqua Iro Keeper',
    baseURL: BETTER_AUTH_URL ?? SITE,
    secret: BETTER_AUTH_SECRET,
    database: drizzleAdapter(db, {
      provider: 'pg',
      schema: {
        user: schema.user,
        session: schema.session,
        account: schema.account,
        verification: schema.verification,
        twoFactor: schema.twoFactor,
        rateLimit: schema.rateLimit,
      },
    }),
    emailAndPassword: {
      enabled: true,
      disableSignUp: !opts.allowSignUp,
      minPasswordLength: 14,
      maxPasswordLength: 256,
    },
    session: { expiresIn: 60 * 60 * 24 * 7, updateAge: 60 * 60 * 24 },
    rateLimit: {
      enabled: true,
      storage: 'database' as const,
      customRules: { '/sign-in/email': { window: 600, max: 5 }, '/two-factor/*': { window: 600, max: 10 } },
    },
    trustedOrigins: [SITE, BETTER_AUTH_URL ?? SITE].filter(Boolean) as string[],
    advanced: { useSecureCookies: SITE.startsWith('https://'), cookiePrefix: 'aia-keeper' },
    plugins: [twoFactor({ issuer: 'Aqua Iro Archive' })],
    hooks: {
      after: createAuthMiddleware(async (ctx) => {
        if (!ctx.path.startsWith('/sign-in')) return;
        const ok =
          !!ctx.context.newSession ||
          !!(ctx.context.returned as { twoFactorRedirect?: boolean } | undefined)?.twoFactorRedirect;
        const ip = ctx.request?.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? '';
        const country = ctx.request?.headers.get('x-vercel-ip-country') ?? '??';
        await db.execute(
          sql`INSERT INTO admin_actions (action, detail) VALUES (${ok ? 'login' : 'login_failed'}::admin_action_kind, ${JSON.stringify({ country, ipPrefix: ip.split('.').slice(0, 2).join('.') })}::jsonb)`,
        );
        if (ok) alertLater(DISCORD_WEBHOOK_URL, `🔐 Keeper sign-in step passed (${country})`);
        else {
          const [r] = rows<{ n: number }>(
            await db.execute(
              sql`SELECT count(*)::int AS n FROM admin_actions WHERE action = 'login_failed' AND created_at > now() - interval '1 hour'`,
            ),
          );
          if ((r?.n ?? 0) === 5)
            alertLater(DISCORD_WEBHOOK_URL, '🔐 5 failed keeper logins in the last hour');
        }
      }),
    },
  };
}

const make = () => betterAuth(authOptions());
let instance: ReturnType<typeof make> | null = null;
export function auth(): ReturnType<typeof make> {
  instance ??= make();
  return instance;
}
