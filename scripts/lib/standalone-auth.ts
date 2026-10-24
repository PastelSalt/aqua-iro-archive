/** Better Auth instance for local scripts (no astro:env): reads process.env directly. */
import { existsSync, readFileSync } from 'node:fs';
import { parseEnv } from 'node:util';
import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { twoFactor } from 'better-auth/plugins';
import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from 'ws';
import * as schema from '../../src/server/db/schema.ts';

/**
 * Loads .env.production.local (when present) over the shell's environment, so the production scripts need
 * no `set -a` / PowerShell loading step, then checks the values look real. Errors name the variable but
 * never print its value.
 */
export function loadProdEnv(file = '.env.production.local') {
  if (existsSync(file)) {
    Object.assign(process.env, parseEnv(readFileSync(file, 'utf8')));
    console.log(`Loaded ${file}`);
  }
  const problems: string[] = [];
  const db = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL ?? '';
  if (!/^postgres(ql)?:\/\/\S+$/.test(db))
    problems.push('DATABASE_URL_UNPOOLED must be the postgresql://… URL from Vercel (Production)');
  const secret = process.env.BETTER_AUTH_SECRET ?? '';
  if (secret.length < 32 || secret.includes('…'))
    problems.push('BETTER_AUTH_SECRET must be the exact production value from Vercel (32+ characters)');
  if (!/^https:\/\//.test(process.env.BETTER_AUTH_URL ?? ''))
    problems.push('BETTER_AUTH_URL must be https://aqua-iro-archive.vercel.app');
  if (problems.length) {
    console.error(`Fix ${file} first:\n${problems.map((p) => `  - ${p}`).join('\n')}`);
    process.exit(1);
  }
}

export function scriptDb() {
  const url = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;
  if (!url) throw new Error('Set DATABASE_URL_UNPOOLED (or DATABASE_URL)');
  neonConfig.webSocketConstructor = ws;
  const pool = new Pool({ connectionString: url });
  return { db: drizzle({ client: pool, schema }), pool };
}

export function scriptAuth(db: ReturnType<typeof scriptDb>['db'], allowSignUp: boolean) {
  if (!process.env.BETTER_AUTH_SECRET) throw new Error('Set BETTER_AUTH_SECRET');
  return betterAuth({
    secret: process.env.BETTER_AUTH_SECRET,
    baseURL: process.env.BETTER_AUTH_URL ?? 'http://localhost:4321',
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
      disableSignUp: !allowSignUp,
      minPasswordLength: 14,
      maxPasswordLength: 256,
    },
    plugins: [twoFactor({ issuer: 'Aqua Iro Archive' })],
  });
}

export async function askHidden(question: string): Promise<string> {
  process.stdout.write(question);
  const stdin = process.stdin;
  stdin.setRawMode?.(true);
  stdin.resume();
  stdin.setEncoding('utf8');
  return new Promise((resolve) => {
    let v = '';
    const on = (c: string) => {
      if (c === '\r' || c === '\n' || c === '\u0004') {
        stdin.setRawMode?.(false);
        stdin.pause();
        stdin.off('data', on);
        process.stdout.write('\n');
        resolve(v);
      } else if (c === '\u0003') process.exit(1);
      else if (c === '\u007f') v = v.slice(0, -1);
      else v += c;
    };
    stdin.on('data', on);
  });
}
