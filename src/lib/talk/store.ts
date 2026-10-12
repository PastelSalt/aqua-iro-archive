/**
 * Shared Talk state: the session backlog (LOG → Backlog) and the Memory album (LOG → 思い出アルバム).
 * Module singletons are shared between the DialogueBox and LogDrawer islands.
 */
import { signal } from '@preact/signals';
import { KEYS, read, write } from '../storage';
import type { CompiledScript } from './types';

export type BacklogLine = { who: 'aqua' | 'you'; ja?: string; en?: string };

export const backlog = signal<BacklogLine[]>([]);
export const album = signal<Record<string, string>>(read<Record<string, string>>(KEYS.talkAlbum, {}));

export function logLine(line: BacklogLine) {
  backlog.value = [...backlog.value, line].slice(-200);
}
export function markFound(convId: string) {
  if (album.value[convId]) return;
  const next = { ...album.value, [convId]: new Date().toISOString() };
  album.value = next;
  write(KEYS.talkAlbum, next);
}

let scriptPromise: Promise<CompiledScript> | null = null;
export function loadScript(): Promise<CompiledScript> {
  scriptPromise ??= fetch('/talk.json', { credentials: 'omit' })
    .then((r) => {
      if (!r.ok) throw new Error(`talk.json ${r.status}`);
      return r.json() as Promise<CompiledScript>;
    })
    .catch((e) => {
      scriptPromise = null;
      throw e;
    });
  return scriptPromise;
}
