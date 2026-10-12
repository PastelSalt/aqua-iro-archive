/**
 * Astro Actions (EXECUTIONPLAN §12.2): POST + JSON, CSRF-protected by security.checkOrigin, validated with Zod.
 * Errors carry a stable code in `message`; the UI maps codes to friendly text (§9.7).
 */
import { ActionError, defineAction } from 'astro:actions';
import { z } from 'astro/zod';
import { boardDeps } from '../server/board/deps';
import { postNote } from '../server/board/post';
import { reportNote, REPORT_REASONS } from '../server/board/report';
import { undoNote } from '../server/board/undo';
import { keeper } from './keeper';

const HTTP: Record<string, ConstructorParameters<typeof ActionError>[0]['code']> = {
  BAD_REQUEST: 'BAD_REQUEST',
  LENGTH: 'BAD_REQUEST',
  EMPTY: 'BAD_REQUEST',
  EMOJI: 'BAD_REQUEST',
  LINK: 'BAD_REQUEST',
  PERSONAL: 'BAD_REQUEST',
  FILTER: 'BAD_REQUEST',
  PAUSED: 'SERVICE_UNAVAILABLE',
  BOT: 'FORBIDDEN',
  RATE: 'TOO_MANY_REQUESTS',
  DUPLICATE: 'CONFLICT',
  UNDO_EXPIRED: 'FORBIDDEN',
  INTERNAL: 'INTERNAL_SERVER_ERROR',
};
const fail = (code: string): never => {
  throw new ActionError({ code: HTTP[code] ?? 'BAD_REQUEST', message: code });
};

export const server = {
  board: {
    post: defineAction({
      accept: 'json',
      input: z.object({ body: z.string().max(2000), turnstileToken: z.string().max(2048) }),
      handler: async (input, ctx) => {
        const r = await postNote(input, boardDeps(ctx.clientAddress));
        if (!r.ok) return fail(r.code);
        return r;
      },
    }),
    report: defineAction({
      accept: 'json',
      input: z.object({
        messageId: z.uuid(),
        reason: z.enum(REPORT_REASONS),
        note: z.string().max(200).optional(),
        turnstileToken: z.string().max(2048),
      }),
      handler: async (input, ctx) => {
        const r = await reportNote(input, boardDeps(ctx.clientAddress));
        if (!r.ok) return fail(r.code);
        return r;
      },
    }),
    undo: defineAction({
      accept: 'json',
      input: z.object({ messageId: z.uuid(), undoToken: z.string().max(100) }),
      handler: async (input) => {
        const { db } = await import('../server/db/http');
        const r = await undoNote(input, db());
        if (!r.ok) return fail(r.code);
        return r;
      },
    }),
  },
  keeper,
};
