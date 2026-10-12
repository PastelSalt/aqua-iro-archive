/**
 * Japanese webfont @font-face rules, served once as a cacheable stylesheet instead of being inlined
 * into every page by <Font> (≈ 120 unicode-range slices per weight). Prerendered at build.
 */
import type { APIRoute } from 'astro';
// @ts-expect-error internal virtual module of the Astro Fonts API (same data <Font> renders)
import { componentDataByCssVariable } from 'virtual:astro:assets/fonts/internal';

export const prerender = true;

export const GET: APIRoute = () => {
  const map = componentDataByCssVariable as Map<string, { css: string }>;
  const css = ['--font-maru', '--font-mincho'].map((v) => map.get(v)?.css ?? '').join('\n');
  return new Response(css, { headers: { 'Content-Type': 'text/css; charset=utf-8' } });
};
