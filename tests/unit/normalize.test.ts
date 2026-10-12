import { describe, expect, it } from 'vitest';
import {
  checkText,
  clean,
  compareForm,
  findLink,
  findPersonal,
  graphemeCount,
} from '../../src/lib/text/normalize';

describe('text rules (§13)', () => {
  it('accepts JP-only, EN-only and mixed text', () => {
    expect(checkText('あくたん、6年間ありがとう！').ok).toBe(true);
    expect(checkText('Thank you for every single stream.').ok).toBe(true);
    expect(checkText('ありがとう Akutan ⚓ forever').ok).toBe(true);
  });
  it('counts emoji ZWJ sequences as one grapheme each', () => {
    expect(graphemeCount('👩‍👩‍👧‍👦')).toBe(1);
    expect(graphemeCount('🏳️‍🌈⚓')).toBe(2);
  });
  it('rejects fullwidth and spaced-out URLs', () => {
    expect(findLink('ｈｔｔｐｓ：／／example．com')).not.toBeNull();
    expect(findLink('see h t t p s : / / evil . com')).not.toBeNull();
    expect(findLink('ｗｗｗ.example.com')).not.toBeNull();
    expect(findLink('discord.gg/abc')).not.toBeNull();
    expect(checkText('visit example.com please')).toMatchObject({ ok: false, code: 'LINK' });
  });
  it('does not treat Japanese laughter or normal sentences as links', () => {
    expect(findLink('楽しかったwww')).toBeNull();
    expect(findLink('最高でしたｗｗｗ。またね')).toBeNull();
    expect(findLink('I love you. Me too!')).toBeNull();
    expect(findLink('so cute. Co-op games forever')).toBeNull();
  });
  it('finds personal info', () => {
    expect(findPersonal('mail me at a.b@example.jp')).not.toBeNull();
    expect(findPersonal('follow @someone_123')).not.toBeNull();
    expect(findPersonal('call 090-1234-5678')).not.toBeNull();
    expect(findPersonal('2018年8月8日から2024年')).toBeNull();
  });
  it('strips zalgo, RTL overrides and zero-width characters', () => {
    const zalgo = 'á̂̃̄̅b';
    expect([...clean(zalgo)].length).toBe(4); // a + 2 marks + b
    expect(clean('abc‮evil​x')).toBe('abcevilx');
  });
  it('enforces 300 graphemes and 6 lines', () => {
    expect(checkText('あ'.repeat(300)).ok).toBe(true);
    expect(checkText('あ'.repeat(301))).toMatchObject({ ok: false, code: 'LENGTH' });
    const seven = Array.from({ length: 7 }, (_, i) => `line ${i}`).join('\n');
    const r = checkText(seven);
    expect(r.ok && r.text.split('\n').length).toBe(6);
  });
  it('rejects whitespace-only and punctuation-only input', () => {
    expect(checkText('   \n\n  ')).toMatchObject({ ok: false, code: 'EMPTY' });
    expect(checkText('！！！。。。')).toMatchObject({ ok: false, code: 'EMPTY' });
  });
  it('rejects more than 20 emoji', () => {
    expect(checkText('⚓'.repeat(21))).toMatchObject({ ok: false, code: 'EMOJI' });
  });
  it('compareForm folds width, case, katakana and punctuation', () => {
    expect(compareForm('アクア！ ＡＱＵＡ')).toBe(compareForm('あくあ aqua'));
  });
});
