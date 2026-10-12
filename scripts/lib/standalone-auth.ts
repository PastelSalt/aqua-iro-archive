/** Better Auth instance for local scripts (no astro:env): reads process.env directly. */
import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { twoFactor } from 'better-auth/plugins';
import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from 'ws';
import * as schema from '../../src/server/db/schema.ts';

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
