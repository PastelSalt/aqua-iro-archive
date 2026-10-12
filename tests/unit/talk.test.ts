import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { parse } from 'yaml';
import { parseScripts, validateScript } from '../../src/lib/talk/schema';
import { pickChoices, pickConversation } from '../../src/lib/talk/picker';
import { activeContexts, timeOfDay } from '../../src/lib/talk/context';
import type { Choice, Conversation } from '../../src/lib/talk/types';

const load = () =>
  parseScripts(
    readdirSync('src/content/talk')
      .filter((f) => f.endsWith('.yaml'))
      .map((name) => ({ name, data: parse(readFileSync(`src/content/talk/${name}`, 'utf8')) })),
  );
const seeded = (seed: number) => () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
const conv = (over: Partial<Conversation>): Conversation => ({
  id: 'c',
  title: { ja: 't', en: 't' },
  category: 'ask',
  weight: 10,
  rare: false,
  when: ['any'],
  lines: [{ exp: 'smile', ja: 'a', en: 'a' }],
  choices: ['a', 'b', 'c'].map((id) => ({
    id,
    ja: id,
    en: id,
    weight: 10,
    reply: [{ exp: 'smile', ja: id, en: id }],
  })),
  nodes: {},
  ...over,
});

describe('Talk scripts', () => {
  it('the shipped scripts validate with zero errors', () => {
    const p = load();
    expect(p.errors).toEqual([]);
    const r = validateScript(p.conversations, p.idle, p.expressions, {
      requireGotos: ['about', 'clips', 'discography', 'streaming', 'events', 'arts', 'messages'],
    });
    expect(r.errors).toEqual([]);
    expect(p.conversations.length).toBeGreaterThanOrEqual(21);
    expect(p.idle.length).toBeGreaterThanOrEqual(15);
  });
  it('validator catches missing nodes, cycles, unreachable nodes, unknown expressions and too few choices', () => {
    const exps = [{ id: 'smile', pose: null, fallbackSticker: null }];
    const bad = [
      conv({
        id: 'missing',
        choices: [
          ...conv({}).choices.slice(0, 2),
          { id: 'x', weight: 10, en: 'x', reply: [{ exp: 'smile', en: 'x' }], next: 'nope' },
        ],
      }),
      conv({
        id: 'cycle',
        choices: [
          ...conv({}).choices.slice(0, 2),
          { id: 'x', weight: 10, en: 'x', reply: [{ exp: 'smile', en: 'x' }], next: 'a' },
        ],
        nodes: {
          a: {
            lines: [{ exp: 'smile', en: 'a' }],
            choices: [{ id: 'y', weight: 10, en: 'y', reply: [{ exp: 'smile', en: 'y' }], next: 'b' }],
          },
          b: {
            lines: [{ exp: 'smile', en: 'b' }],
            choices: [{ id: 'z', weight: 10, en: 'z', reply: [{ exp: 'smile', en: 'z' }], next: 'a' }],
          },
        },
      }),
      conv({ id: 'orphan', nodes: { lost: { lines: [{ exp: 'smile', en: 'l' }], choices: [] } } }),
      conv({ id: 'face', lines: [{ exp: 'grin', en: 'g' }] }),
      conv({ id: 'few', choices: conv({}).choices.slice(0, 2) }),
      conv({ id: 'few' }),
    ];
    const r = validateScript(bad, [], exps);
    const all = r.errors.join('\n');
    expect(all).toMatch(/missing.*next "nope"/);
    expect(all).toMatch(/cycle/);
    expect(all).toMatch(/"lost" is unreachable/);
    expect(all).toMatch(/unknown expression "grin"/);
    expect(all).toMatch(/needs at least 3 choices/);
    expect(all).toMatch(/duplicate conversation id/);
  });
});

describe('Talk picker', () => {
  const p = load();
  const ctx = activeContexts({ now: new Date(2026, 9, 12, 14), firstVisit: false });
  it('50 consecutive opens never repeat within the last 8', () => {
    const rand = seeded(42);
    const recent: string[] = [];
    for (let i = 0; i < 50; i++) {
      const c = pickConversation(p.conversations, ctx, recent.slice(-8), {}, [], rand)!; // the engine keeps the last 8
      expect(recent.slice(-8)).not.toContain(c.id);
      recent.push(c.id);
    }
  });
  it('draws rare conversations about 5% of the time', () => {
    const rand = seeded(7);
    let rare = 0;
    const N = 10_000;
    for (let i = 0; i < N; i++) if (pickConversation(p.conversations, ctx, [], {}, [], rand)!.rare) rare++;
    expect(rare / N).toBeGreaterThan(0.03);
    expect(rare / N).toBeLessThan(0.07);
  });
  it('date-specific scripts come first on their day, once', () => {
    const bday = activeContexts({ now: new Date(2026, 11, 1, 20), firstVisit: false });
    expect(pickConversation(p.conversations, bday, [], {}, [])!.id).toBe('special-birthday');
    expect(pickConversation(p.conversations, bday, [], {}, ['special-birthday'])!.id).not.toBe(
      'special-birthday',
    );
  });
  it('shows 3 choices with at most one goto and at least one non-goto', () => {
    const rand = seeded(3);
    const choices: Choice[] = [
      ...['a', 'b'].map((id) => ({ id, weight: 10, en: id, reply: [{ exp: 'smile', en: id }] })),
      ...['g1', 'g2', 'g3'].map((id) => ({
        id,
        weight: 50,
        en: id,
        goto: 'arts' as const,
        reply: [{ exp: 'smile', en: id }],
      })),
    ];
    for (let i = 0; i < 500; i++) {
      const out = pickChoices(choices, rand);
      expect(out.length).toBeLessThanOrEqual(3);
      expect(out.filter((c) => c.goto).length).toBeLessThanOrEqual(1);
      expect(out.some((c) => !c.goto)).toBe(true);
      expect(new Set(out.map((c) => c.id)).size).toBe(out.length);
    }
  });
  it('time of day buckets', () => {
    expect(timeOfDay(new Date(2026, 0, 1, 6))).toBe('morning');
    expect(timeOfDay(new Date(2026, 0, 1, 12))).toBe('day');
    expect(timeOfDay(new Date(2026, 0, 1, 19))).toBe('evening');
    expect(timeOfDay(new Date(2026, 0, 1, 2))).toBe('night');
  });
});
