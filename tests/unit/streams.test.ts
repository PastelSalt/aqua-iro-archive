import { describe, expect, it } from 'vitest';
import { autoTags } from '../../src/lib/streams/tags';
import { applyFilter, type Row } from '../../src/lib/streams/filter';
import { compactEn, compactJa, dotDate, hmm, jstDate } from '../../src/lib/format';
import data from '../../src/content/streams/streams.json';

describe('stream tag rules (§8.4)', () => {
  const games = ['elden ring', 'ポケモン'];
  it('tags karaoke, minecraft, apex, collab and games', () => {
    expect(autoTags('【歌枠】うたうよ！【湊あくあ/ホロライブ】', '2021-01-01', games)).toContain('karaoke');
    expect(autoTags('【Minecraft】建築【湊あくあ/ホロライブ】', '2021-01-01', games)).toContain('minecraft');
    expect(autoTags('【APEX】ソロ', '2021-01-01', games)).toContain('apex');
    expect(autoTags('【オフコラボ】【湊あくあ/宝鐘マリン】', '2021-01-01', games)).toContain('collab');
    expect(autoTags('#1【ELDEN RING】', '2024-01-01', games)).toContain('game');
  });
  it('does not mistake her own hashtag brackets or ホロライブ for collabs / lives', () => {
    expect(autoTags('【3DLIVE】あくあ色【#湊あくあ3Dライブ】', '2021-05-09', games)).not.toContain('collab');
    expect(autoTags('【雑談】【湊あくあ/ホロライブ】', '2021-01-01', games)).not.toContain('live');
  });
  it('graduation tag only after the announcement', () => {
    expect(autoTags('最後の雑談', '2024-08-27', games)).toContain('graduation');
    expect(autoTags('最後のマリカ', '2021-01-01', games)).not.toContain('graduation');
  });
});

describe('stream filter (§9.4)', () => {
  const rows: Row[] = (
    data.streams as {
      id: string;
      year: number;
      tags: string[];
      views: number;
      durationSec: number;
      date: string;
    }[]
  ).map((s) => ({
    el: { hidden: false },
    id: s.id,
    year: s.year,
    tags: s.tags,
    views: s.views,
    sec: s.durationSec,
    date: s.date,
  }));
  it('counts match the summary exactly (639 / 2,013 h)', () => {
    const r = applyFilter(rows, { year: null, tags: [], ids: null });
    expect(r.count).toBe(639);
    expect(Math.round(r.seconds / 3600)).toBe(2013);
    expect(applyFilter(rows, { year: 2020, tags: [], ids: null }).count).toBe(197);
  });
  it('runs in under 16 ms for 639 rows', () => {
    const t = performance.now();
    for (let i = 0; i < 20; i++)
      applyFilter(rows, { year: i % 2 ? 2021 : null, tags: i % 3 ? ['apex'] : [], ids: null });
    expect((performance.now() - t) / 20).toBeLessThan(16);
  });
});

describe('format', () => {
  it('formats dates, durations and compact counts', () => {
    expect(dotDate('2024-08-28')).toBe('2024.08.28');
    expect(jstDate('2026-10-11T20:00:00Z')).toBe('2026.10.12');
    expect(hmm(4780)).toBe('1:19');
    expect(compactEn(8909059)).toBe('8.91M');
    expect(compactEn(38200000)).toBe('38.2M');
    expect(compactEn(896000)).toBe('896K');
    expect(compactEn(12345)).toBe('12.3K');
    expect(compactJa(8909059)).toBe('891万');
  });
});
