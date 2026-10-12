/** Stream tag rules (EXECUTIONPLAN §8.4). First pass only; data/overrides/stream-categories.yaml fixes the rest. */

export const STREAM_TAGS = [
  'karaoke',
  'minecraft',
  'apex',
  'game',
  'chat',
  'collab',
  '3d',
  'live',
  'anniversary',
  'milestone',
  'special',
  'graduation',
] as const;
export type StreamTag = (typeof STREAM_TAGS)[number];

const has = (t: string, words: string[]) => words.some((w) => t.includes(w));

/** Talent-bracket collab: 【湊あくあ/宝鐘マリン】, 【ホロライブ/夏色まつり・湊あくあ・宝鐘マリン】 */
function bracketCollab(t: string): boolean {
  for (const m of t.matchAll(/【([^】]*)】/g)) {
    const inner = m[1]!.replace(/\s/g, '');
    if (!inner.includes('湊あくあ') && !inner.includes('あくあ')) continue;
    const parts = inner.split(/[/／・]/).filter(Boolean);
    if (parts.length < 2) continue;
    const others = parts.filter(
      (n) => !n.includes('あくあ') && !['ホロライブ', 'hololive', 'minecraft', 'マイクラ'].includes(n),
    );
    if (others.length > 0) return true;
  }
  return false;
}

export function autoTags(rawTitle: string, date: string, games: string[]): StreamTag[] {
  const t = rawTitle.normalize('NFKC').toLowerCase();
  const tags = new Set<StreamTag>();

  if (
    has(t, [
      '歌枠',
      'うたわく',
      'karaoke',
      '歌う',
      '歌って',
      '歌い',
      '歌お',
      '歌っちゃ',
      '歌います',
      'singing',
      'うたああ',
    ])
  )
    tags.add('karaoke');
  if (
    has(t, [
      'minecraft',
      'マイクラ',
      'akukin建設',
      'akukin本社',
      'エンドラ',
      'ウィザー',
      'ホロ鯖爆破',
      '隣人戦争',
    ])
  )
    tags.add('minecraft');
  if (t.includes('apex')) tags.add('apex');
  if (
    has(t, [
      '雑談',
      'freetalk',
      'おしゃべり',
      '朝活',
      '朝枠',
      'ざつだん',
      '雑☆談',
      'おはなし',
      'はなす',
      'はなそう',
      'しゃべ',
      'トーク',
      '近況報告',
      'マシュマロ',
      '年越し',
      'あけおめ',
      '振り返り',
      'カメラ',
      'ゲリラ',
    ])
  )
    tags.add('chat');
  if (t.includes('3d')) tags.add('3d');
  if (isLiveTitle(rawTitle)) tags.add('live');
  if (has(t, ['周年', 'anniversary', '記念', '誕生日', 'birthday', '生誕祭'])) tags.add('anniversary');
  if (
    has(t, ['with ', 'コラボ', '×', '#チームnass', '#v最協', '#ホロ', '凸待ち', 'オフコラボ']) ||
    bracketCollab(rawTitle.normalize('NFKC'))
  )
    tags.add('collab');
  if (has(t, ['重大発表', '重 大 発 表', 'お披露目', '新衣装', '初配信', '大切なお知らせ']))
    tags.add('special');
  if (date >= '2024-08-06' && has(t, ['卒業', '最後'])) tags.add('graduation');
  if (!tags.has('minecraft') && !tags.has('apex') && games.some((g) => t.includes(g))) tags.add('game');

  return STREAM_TAGS.filter((x) => tags.has(x));
}

/** "ホロライブ" contains "ライブ"; only count ライブ when it isn't part of ホロライブ or ライブ配信. */
export function isLiveTitle(rawTitle: string): boolean {
  const t = rawTitle
    .normalize('NFKC')
    .toLowerCase()
    .replace(/ホロライブ/g, '')
    .replace(/ライブ配信/g, '');
  return t.includes('ライブ') || /\blive\b/.test(t);
}
