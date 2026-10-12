/**
 * Compiled Talk with Aqua script (EXECUTIONPLAN §10.4). Prerendered at build; the DialogueBox fetches it on idle.
 * Expressions are resolved to optimized official-pose URLs here so the client never handles asset paths.
 */
import type { APIRoute, ImageMetadata } from 'astro';
import { getImage } from 'astro:assets';
import { parse } from 'yaml';
import { compile, parseScripts } from '../lib/talk/schema';

export const prerender = true;

const raw = import.meta.glob<string>('/src/content/talk/*.yaml', {
  query: '?raw',
  import: 'default',
  eager: true,
});
const poses = import.meta.glob<{ default: ImageMetadata }>('/src/assets/poses/*.{webp,png}', { eager: true });

export const GET: APIRoute = async () => {
  const files = Object.entries(raw).map(([path, text]) => ({
    name: path.split('/').pop()!,
    data: parse(text) as unknown,
  }));
  const { conversations, idle, expressions, errors } = parseScripts(files);
  if (errors.length) throw new Error(`talk.json: invalid scripts\n${errors.join('\n')}`);

  const resolved: Record<string, { pose: string | null; sticker: string | null }> = {};
  for (const e of expressions) {
    let pose: string | null = null;
    if (e.pose) {
      const mod = Object.entries(poses).find(([p]) => p.includes(`/poses/${e.pose}.`))?.[1];
      if (!mod) throw new Error(`talk.json: pose "${e.pose}" not found in src/assets/poses`);
      pose = (await getImage({ src: mod.default, height: 1100, format: 'webp' })).src;
    }
    resolved[e.id] = { pose, sticker: e.fallbackSticker };
  }
  return new Response(JSON.stringify(compile(conversations, idle, resolved)), {
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
};
