import type { DB } from '../db/types';

export type BoardDeps = {
  db: DB;
  ipSecret: string;
  turnstileSecret: string;
  hostnames: string[];
  clientIp: string;
  discordWebhook?: string;
  siteUrl: string;
  fetchImpl?: typeof fetch;
  now?: () => Date;
};

export type PostCode =
  | 'BAD_REQUEST'
  | 'PAUSED'
  | 'BOT'
  | 'LENGTH'
  | 'EMPTY'
  | 'EMOJI'
  | 'LINK'
  | 'PERSONAL'
  | 'RATE'
  | 'DUPLICATE'
  | 'FILTER'
  | 'INTERNAL';
export type PostResult =
  | {
      ok: true;
      id: string;
      crewNo: number;
      status: 'visible' | 'held';
      createdAt: string;
      undoToken: string;
      undoUntil: string;
    }
  | { ok: false; code: PostCode };

export type PublicNote = {
  id: string;
  crewNo: number;
  status: 'visible' | 'under_review';
  body: string | null;
  createdAt: string;
};
