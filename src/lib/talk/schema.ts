/**
 * Talk with Aqua — shared authoring schema + graph validator (EXECUTIONPLAN §10.2–10.3).
 * Used by scripts/validate-talk.ts (build gate), the prerendered /talk.json endpoint and the unit tests.
 */
import { z } from 'astro/zod';
import { CHAPTER_IDS } from '../chapters';
import type { CompiledScript, Conversation, Expression, IdleLine } from './types';

export const WHEN = [
  'any',
  'morning',
  'day',
  'evening',
  'night',
  'birthday',
  'anniversary',
  'graduation',
  'first-visit',
  'returning',
] as const;
export const DATE_SPECIFIC = new Set(['birthday', 'anniversary', 'graduation']);
export const CATEGORIES = ['ask', 'tease', 'cheer', 'explore', 'special'] as const;

const Text = { ja: z.string().min(1).optional(), en: z.string().min(1).optional() };
const needOne = (v: { ja?: string; en?: string }) => !!(v.ja || v.en);

export const LineSchema = z
  .object({ exp: z.string().default('smile'), ...Text })
  .refine(needOne, 'line needs ja or en');

const ChoiceSchema = z
  .object({
    id: z.string().regex(/^[a-z0-9-]+$/),
    ...Text,
    weight: z.number().positive().default(10),
    reply: z.array(LineSchema).min(1, 'reply is empty'),
    next: z.string().optional(),
    goto: z.enum(CHAPTER_IDS).optional(),
  })
  .refine(needOne, 'choice needs ja or en');

const NodeSchema = z.object({
  lines: z.array(LineSchema).min(1),
  choices: z.array(ChoiceSchema).default([]),
});

export const ConversationSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  title: z.object({ ja: z.string().min(1), en: z.string().min(1) }),
  category: z.enum(CATEGORIES),
  weight: z.number().positive().default(10),
  rare: z.boolean().default(false),
  when: z.array(z.enum(WHEN)).min(1).default(['any']),
  lines: z.array(LineSchema).min(1),
  choices: z.array(ChoiceSchema),
  nodes: z.record(z.string(), NodeSchema).default({}),
});

export const IdleSchema = z
  .object({
    id: z.string(),
    exp: z.string().default('smile'),
    ...Text,
    when: z.array(z.enum(WHEN)).min(1).default(['any']),
  })
  .refine(needOne, 'idle line needs ja or en');

export const ExpressionSchema = z.object({
  id: z.string(),
  pose: z.string().nullable().default(null),
  fallbackSticker: z.string().nullable().default(null),
});

export type Report = {
  errors: string[];
  warnings: string[];
  stats: Record<string, number>;
  titles: string[];
};

/** Graph + content checks. Pure: no I/O. */
export function validateScript(
  convs: Conversation[],
  idle: IdleLine[],
  expressions: Expression[],
  opts: { watchlist?: string[]; requireGotos?: readonly string[] } = {},
): Report {
  const errors: string[] = [];
  const warnings: string[] = [];
  const exps = new Set(expressions.map((e) => e.id));
  const stats: Record<string, number> = {};

  const ids = new Set<string>();
  for (const c of convs) {
    const where = `conversation "${c.id}"`;
    if (ids.has(c.id)) errors.push(`${where}: duplicate conversation id`);
    ids.add(c.id);
    stats[`category:${c.category}`] = (stats[`category:${c.category}`] ?? 0) + 1;

    const allLines = [
      ...c.lines,
      ...c.choices.flatMap((x) => x.reply),
      ...Object.values(c.nodes).flatMap((n) => [...n.lines, ...n.choices.flatMap((x) => x.reply)]),
    ];
    const allChoices = [...c.choices, ...Object.values(c.nodes).flatMap((n) => n.choices)];

    const cids = new Set<string>();
    for (const ch of allChoices) {
      if (cids.has(ch.id)) errors.push(`${where}: duplicate choice id "${ch.id}"`);
      cids.add(ch.id);
      if (ch.next && !c.nodes[ch.next])
        errors.push(`${where}: choice "${ch.id}" → next "${ch.next}" does not exist`);
      if (ch.next && ch.goto)
        warnings.push(`${where}: choice "${ch.id}" has both next and goto (goto is offered after the node)`);
      const label = `${ch.ja ?? ''}${ch.en ?? ''}`;
      for (const w of opts.watchlist ?? [])
        if (w && label.toLowerCase().includes(w.toLowerCase()))
          warnings.push(`${where}: choice "${ch.id}" mentions watchlist word "${w}" — re-read it`);
    }
    if (c.choices.length < 3) errors.push(`${where}: needs at least 3 choices (has ${c.choices.length})`);
    else if (c.choices.length < 4)
      warnings.push(`${where}: only ${c.choices.length} candidate choices; 4+ keeps visits varied`);
    if (c.choices.length && c.choices.every((x) => x.goto)) warnings.push(`${where}: every choice is a goto`);

    for (const l of allLines) {
      if (!exps.has(l.exp)) errors.push(`${where}: unknown expression "${l.exp}"`);
      if (!l.ja || !l.en) warnings.push(`${where}: a line is missing ${l.ja ? 'en' : 'ja'}`);
      if (l.ja && [...l.ja].length > 40) warnings.push(`${where}: ja line over 40 chars: ${l.ja}`);
      if (l.en && l.en.length > 90) warnings.push(`${where}: en line over 90 chars: ${l.en}`);
      for (const w of opts.watchlist ?? [])
        if (w && `${l.ja ?? ''} ${l.en ?? ''}`.toLowerCase().includes(w.toLowerCase()))
          warnings.push(`${where}: line mentions watchlist word "${w}" — re-read it`);
    }

    // node graph: reachability + cycles
    const edges = (from: string | null) =>
      (from === null ? c.choices : (c.nodes[from]?.choices ?? []))
        .map((x) => x.next)
        .filter((x): x is string => !!x);
    const reached = new Set<string>();
    const stack: string[] = [];
    const visit = (n: string | null, path: string[]) => {
      for (const nx of edges(n)) {
        if (path.includes(nx)) {
          errors.push(`${where}: node cycle ${[...path, nx].join(' → ')}`);
          continue;
        }
        if (!c.nodes[nx]) continue;
        reached.add(nx);
        stack.push(nx);
        visit(nx, [...path, nx]);
        stack.pop();
      }
    };
    visit(null, []);
    for (const n of Object.keys(c.nodes))
      if (!reached.has(n)) errors.push(`${where}: node "${n}" is unreachable`);
  }

  for (const l of idle) {
    if (!exps.has(l.exp)) errors.push(`idle "${l.id}": unknown expression "${l.exp}"`);
    if (!l.ja || !l.en) warnings.push(`idle "${l.id}": missing ${l.ja ? 'en' : 'ja'}`);
  }
  const idleIds = new Set<string>();
  for (const l of idle) {
    if (idleIds.has(l.id)) errors.push(`idle "${l.id}": duplicate id`);
    idleIds.add(l.id);
  }

  // coverage per context
  for (const w of WHEN) {
    const n = convs.filter(
      (c) => c.when.includes(w) || (c.when.includes('any') && !DATE_SPECIFIC.has(w)),
    ).length;
    stats[`context:${w}`] = n;
    if (!DATE_SPECIFIC.has(w) && n < 3)
      warnings.push(`only ${n} conversation(s) available for context "${w}"`);
  }
  // every chapter reachable through some goto
  const gotos = new Set(
    convs
      .flatMap((c) => [...c.choices, ...Object.values(c.nodes).flatMap((n) => n.choices)])
      .map((x) => x.goto)
      .filter(Boolean),
  );
  for (const g of opts.requireGotos ?? [])
    if (!gotos.has(g as never)) errors.push(`no goto leads to chapter "${g}"`);

  stats.conversations = convs.length;
  stats.idle = idle.length;
  stats.rare = convs.filter((c) => c.rare).length;
  return {
    errors,
    warnings,
    stats,
    titles: convs.map((c) => `${c.rare ? '✦ ' : ''}${c.title.ja} / ${c.title.en}`),
  };
}

/** Parse raw YAML documents (already loaded as JS) into typed scripts, collecting Zod errors. */
export function parseScripts(files: { name: string; data: unknown }[]) {
  const conversations: Conversation[] = [];
  const idle: IdleLine[] = [];
  let expressions: Expression[] = [];
  const errors: string[] = [];
  for (const f of files) {
    const list = Array.isArray(f.data) ? f.data : [];
    if (!Array.isArray(f.data)) errors.push(`${f.name}: expected a YAML list`);
    const schema =
      f.name === 'idle.yaml'
        ? IdleSchema
        : f.name === 'expressions.yaml'
          ? ExpressionSchema
          : ConversationSchema;
    list.forEach((item, i) => {
      const r = schema.safeParse(item);
      if (!r.success) {
        const id = (item as { id?: string })?.id ?? `#${i}`;
        errors.push(
          `${f.name} ${id}: ${r.error.issues.map((x) => `${x.path.join('.')} ${x.message}`).join('; ')}`,
        );
        return;
      }
      if (f.name === 'idle.yaml') idle.push(r.data as IdleLine);
      else if (f.name === 'expressions.yaml') expressions.push(r.data as Expression);
      else conversations.push(r.data as unknown as Conversation);
    });
  }
  if (!expressions.length) expressions = [{ id: 'smile', pose: null, fallbackSticker: null }];
  return { conversations, idle, expressions, errors };
}

export function compile(
  convs: Conversation[],
  idle: IdleLine[],
  expressions: Record<string, { pose: string | null; sticker: string | null }>,
): CompiledScript {
  return { version: 1, conversations: convs, idle, expressions };
}
