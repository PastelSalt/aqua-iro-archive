/**
 * keeper.* actions (EXECUTIONPLAN §12.2 / §15). Middleware already guards /_actions/keeper.*; every handler
 * checks again (defense in depth) and writes an audit row.
 */
import { ActionError, defineAction, type ActionAPIContext } from 'astro:actions';
import { z } from 'astro/zod';
import { sql } from 'drizzle-orm';
import { DISCORD_WEBHOOK_URL } from 'astro:env/server';

async function requireAdmin(ctx: ActionAPIContext) {
  const { auth } = await import('../server/auth');
  const s = await auth().api.getSession({ headers: ctx.request.headers });
  const u = s?.user as { id: string; twoFactorEnabled?: boolean | null } | undefined;
  if (!u) throw new ActionError({ code: 'UNAUTHORIZED', message: 'UNAUTHORIZED' });
  if (!u.twoFactorEnabled) throw new ActionError({ code: 'FORBIDDEN', message: '2FA_REQUIRED' });
  const { dbTx } = await import('../server/db/pool');
  return { actor: u.id, db: dbTx() as never };
}
const Ids = z.array(z.uuid()).min(1).max(200);

export const keeper = {
  approve: defineAction({
    accept: 'json',
    input: z.object({ ids: Ids }),
    handler: async ({ ids }, ctx) => {
      const { actor, db } = await requireAdmin(ctx);
      const { approve } = await import('../server/board/moderation');
      return { count: await approve(db, actor, ids) };
    },
  }),
  remove: defineAction({
    accept: 'json',
    input: z.object({ ids: Ids, reason: z.string().min(1).max(300) }),
    handler: async ({ ids, reason }, ctx) => {
      const { actor, db } = await requireAdmin(ctx);
      const { remove } = await import('../server/board/moderation');
      return { count: await remove(db, actor, ids, reason) };
    },
  }),
  restore: defineAction({
    accept: 'json',
    input: z.object({ id: z.uuid() }),
    handler: async ({ id }, ctx) => {
      const { actor, db } = await requireAdmin(ctx);
      const { restore } = await import('../server/board/moderation');
      return { count: await restore(db, actor, id) };
    },
  }),
  purge: defineAction({
    accept: 'json',
    input: z.object({ id: z.uuid(), crewNo: z.number().int().positive() }),
    handler: async ({ id, crewNo }, ctx) => {
      const { actor, db } = await requireAdmin(ctx);
      const { purge } = await import('../server/board/moderation');
      try {
        return { count: await purge(db, actor, id, crewNo) };
      } catch (e) {
        throw new ActionError({ code: 'BAD_REQUEST', message: (e as Error).message });
      }
    },
  }),
  settings: defineAction({
    accept: 'json',
    input: z.object({ key: z.string().max(40), value: z.union([z.boolean(), z.number()]) }),
    handler: async ({ key, value }, ctx) => {
      const { actor, db } = await requireAdmin(ctx);
      const { validateSetting, setSetting, getSettings } = await import('../server/settings');
      const err = validateSetting(key, value);
      if (err) throw new ActionError({ code: 'BAD_REQUEST', message: err });
      const before = (await getSettings(db, true))[key as 'max_len'];
      await setSetting(db, key, value);
      const kind = key === 'posting_paused' ? (value ? 'pause' : 'resume') : 'settings_change';
      await (db as { execute: (q: unknown) => Promise<unknown> }).execute(
        sql`INSERT INTO admin_actions (actor_id, action, detail) VALUES (${actor}, ${kind}::admin_action_kind, ${JSON.stringify({ key, before, after: value })}::jsonb)`,
      );
      if (key === 'posting_paused' || key === 'newcomer_hold') {
        const { sendAlert } = await import('../server/alerts');
        await sendAlert(DISCORD_WEBHOOK_URL, `⚙️ ${key} → ${value ? 'ON' : 'OFF'} (keeper)`);
      }
      return { ok: true };
    },
  }),
  termAdd: defineAction({
    accept: 'json',
    input: z.object({
      term: z.string().min(1).max(200),
      kind: z.enum(['substring', 'word', 'regex']),
      action: z.enum(['hold', 'reject']),
      note: z.string().max(200).optional(),
    }),
    handler: async (input, ctx) => {
      const { actor, db } = await requireAdmin(ctx);
      if (input.kind === 'regex')
        try {
          new RegExp(input.term, 'iu');
        } catch {
          throw new ActionError({ code: 'BAD_REQUEST', message: 'Invalid regular expression' });
        }
      const d = db as { execute: (q: unknown) => Promise<unknown> };
      await d.execute(
        sql`INSERT INTO blocked_terms (term, kind, action, note) VALUES (${input.term}, ${input.kind}, ${input.action}, ${input.note ?? null}) ON CONFLICT (term, kind) DO UPDATE SET action = EXCLUDED.action, note = EXCLUDED.note`,
      );
      await d.execute(
        sql`INSERT INTO admin_actions (actor_id, action, detail) VALUES (${actor}, 'term_add', ${JSON.stringify({ kind: input.kind, action: input.action })}::jsonb)`,
      );
      (await import('../server/board/filter'))._resetTermsCache();
      return { ok: true };
    },
  }),
  termRemove: defineAction({
    accept: 'json',
    input: z.object({ id: z.number().int() }),
    handler: async ({ id }, ctx) => {
      const { actor, db } = await requireAdmin(ctx);
      const d = db as { execute: (q: unknown) => Promise<unknown> };
      await d.execute(sql`DELETE FROM blocked_terms WHERE id = ${id}`);
      await d.execute(
        sql`INSERT INTO admin_actions (actor_id, action, detail) VALUES (${actor}, 'term_remove', ${JSON.stringify({ id })}::jsonb)`,
      );
      (await import('../server/board/filter'))._resetTermsCache();
      return { ok: true };
    },
  }),
  termTest: defineAction({
    accept: 'json',
    input: z.object({ text: z.string().max(2000) }),
    handler: async ({ text }, ctx) => {
      const { db } = await requireAdmin(ctx);
      const { loadTerms, testSentence } = await import('../server/board/filter');
      const r = testSentence(text, await loadTerms(db, true));
      return {
        terms: r.terms.map((t) => ({ id: t.id, term: t.term, action: t.action })),
        english: r.english,
      };
    },
  }),
  testAlert: defineAction({
    accept: 'json',
    handler: async (_input, ctx) => {
      await requireAdmin(ctx);
      const { sendAlert } = await import('../server/alerts');
      await sendAlert(DISCORD_WEBHOOK_URL, '✅ Test alert from /keeper/settings');
      return { ok: !!DISCORD_WEBHOOK_URL };
    },
  }),
};
