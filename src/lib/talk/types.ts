/** Talk with Aqua types (EXECUTIONPLAN §10). The Zod schema in ./schema.ts is the source of truth for authoring. */
import type { ChapterId } from '../chapters';

export type Line = { exp: string; ja?: string; en?: string };
export type Choice = {
  id: string;
  ja?: string;
  en?: string;
  weight: number;
  reply: Line[];
  next?: string;
  goto?: ChapterId;
};
export type Node = { lines: Line[]; choices: Choice[] };
export type Conversation = {
  id: string;
  title: { ja: string; en: string };
  category: 'ask' | 'tease' | 'cheer' | 'explore' | 'special';
  weight: number;
  rare: boolean;
  when: When[];
  lines: Line[];
  choices: Choice[];
  nodes: Record<string, Node>;
};
export type IdleLine = { id: string; exp: string; ja?: string; en?: string; when: When[] };
export type Expression = { id: string; pose: string | null; fallbackSticker: string | null };
export type When =
  | 'any'
  | 'morning'
  | 'day'
  | 'evening'
  | 'night'
  | 'birthday'
  | 'anniversary'
  | 'graduation'
  | 'first-visit'
  | 'returning';

/** What /talk.json serves. `poses` maps expression id → built image URL (or null → sticker). */
export type CompiledScript = {
  version: 1;
  conversations: Conversation[];
  idle: IdleLine[];
  expressions: Record<string, { pose: string | null; sticker: string | null }>;
};
