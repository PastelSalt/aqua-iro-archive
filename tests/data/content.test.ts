/** Data checks (§23): every YAML file parses, IDs are unique, YouTube IDs are 11 chars, every art has alt + credit. */
import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'yaml';
import data from '../../src/content/streams/streams.json';

function yamlFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? (f === 'talk' ? [] : yamlFiles(p)) : f.endsWith('.yaml') ? [p] : [];
  });
}

describe('content data', () => {
  for (const f of yamlFiles('src/content')) {
    it(`${f}: list of objects with unique ids`, () => {
      const list = parse(readFileSync(f, 'utf8')) as { id: string }[];
      expect(Array.isArray(list)).toBe(true);
      const ids = list.map((x) => String(x.id));
      expect(new Set(ids).size).toBe(ids.length);
      for (const x of list as Record<string, unknown>[]) {
        for (const k of ['youtube']) if (x[k]) expect(String(x[k])).toMatch(/^[\w-]{11}$/);
        for (const v of Object.values(x))
          if (v && typeof v === 'object' && !Array.isArray(v) && ('ja' in v || 'en' in v))
            expect(Object.keys(v).every((k) => k === 'ja' || k === 'en')).toBe(true);
      }
    });
  }
  it('every artwork has bilingual alt text, an artist, a credit and a source', () => {
    const arts = parse(readFileSync('src/content/arts/arts.yaml', 'utf8')) as Record<
      string,
      Record<string, string> & string
    >[];
    expect(arts.length).toBeGreaterThan(100);
    for (const a of arts) {
      expect(a.alt?.ja, a.id).toBeTruthy();
      expect(a.alt?.en, a.id).toBeTruthy();
      expect(a.artist, a.id).toBeTruthy();
      expect(a.credit, a.id).toMatch(/©/);
      expect(a.source, a.id).toMatch(/^https:\/\//);
    }
  });
  it('streams.json holds the asserted totals', () => {
    expect(data.streams.length).toBe(639);
    expect(data.summary.hours).toBe(2013);
    expect(new Set(data.streams.map((s) => s.id)).size).toBe(639);
  });
});
