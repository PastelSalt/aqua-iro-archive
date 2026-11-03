/**
 * Keeper preview only (see ./preview.ts): made-up Umami numbers in the same shapes as src/server/umami.ts, using
 * real IDs from the site's content so labels resolve. Deterministic per day so reloads look stable.
 */
import { labels } from '../labels';

let seed = 1;
const rnd = () => {
  seed = (seed * 16807) % 2147483647;
  return seed / 2147483647;
};
const reset = (s: string) => {
  seed = [...s].reduce((a, c) => (a * 31 + c.charCodeAt(0)) % 2147483647, 7) || 7;
};
const pairs = (xs: [string, number][]) => xs.map(([x, y]) => ({ x, y }));
const stat = (base: number) => {
  const visitors = Math.round(base * (0.8 + rnd() * 0.4));
  const s = {
    visitors,
    visits: Math.round(visitors * 1.3),
    pageviews: Math.round(visitors * 3.1),
    bounces: Math.round(visitors * 0.45),
    totaltime: visitors * 190,
  };
  return {
    ...s,
    prev: {
      visitors: Math.round(visitors * 0.9),
      visits: Math.round(s.visits * 0.92),
      pageviews: Math.round(s.pageviews * 1.04),
      bounces: Math.round(s.bounces * 1.1),
      totaltime: Math.round(s.totaltime * 0.95),
    },
  };
};

export async function previewVisitors(rangeId: string, unit: 'day' | 'week' | 'month', full: boolean) {
  reset(`${rangeId}${unit}${new Date().toISOString().slice(0, 10)}`);
  const days = { '24h': 1, '7d': 7, '30d': 30, '90d': 90, '1y': 365 }[rangeId] ?? 7;
  const n = unit === 'month' ? 12 : unit === 'week' ? 12 : Math.max(7, Math.min(days, 90));
  const step = unit === 'month' ? 30 : unit === 'week' ? 7 : 1;
  const pv = Array.from({ length: n }, (_, i) => {
    const d = new Date(Date.now() - (n - 1 - i) * step * 86400_000);
    return {
      x: d.toISOString().slice(0, unit === 'month' ? 7 : 10),
      y: Math.round((40 + 30 * Math.abs(Math.sin(i / 2.3)) + i) * step * (0.8 + rnd() * 0.4)),
    };
  });
  const limit = full ? 25 : 8;
  return {
    stats: stat(Math.min(days, 90) * 42),
    periods: { today: stat(46), week: stat(260), month: stat(980) },
    unit,
    series: { pageviews: pv, sessions: pv.map((p) => ({ x: p.x, y: Math.round(p.y * 0.42) })) },
    paths: pairs([
      ['/', 980],
      ['/streaming', 610],
      ['/discography', 430],
      ['/messages', 390],
      ['/clips', 280],
      ['/arts', 240],
      ['/about', 190],
      ['/events', 120],
      ['/credits', 30],
    ]).slice(0, limit),
    referrers: pairs([
      ['x.com', 420],
      ['youtube.com', 260],
      ['google.com', 140],
      ['reddit.com', 60],
      ['discord.com', 40],
    ]),
    countries: pairs([
      ['JP', 820],
      ['US', 210],
      ['PH', 120],
      ['ID', 90],
      ['TW', 70],
      ['KR', 40],
      ['BR', 22],
    ]),
    devices: pairs([
      ['mobile', 1020],
      ['desktop', 470],
      ['tablet', 60],
    ]),
    browsers: pairs([
      ['chrome', 760],
      ['ios', 420],
      ['safari', 180],
      ['edge-chromium', 120],
      ['firefox', 40],
    ]),
    os: full
      ? pairs([
          ['iOS', 520],
          ['Android', 500],
          ['Windows', 380],
          ['Mac OS', 110],
        ])
      : [],
    languages: full
      ? pairs([
          ['ja-JP', 810],
          ['en-US', 520],
          ['zh-TW', 70],
          ['ko-KR', 30],
        ])
      : [],
    screens: full
      ? pairs([
          ['390x844', 400],
          ['1920x1080', 300],
          ['1366x768', 160],
          ['430x932', 150],
        ])
      : [],
    weekly: full
      ? Array.from({ length: 7 }, (_, d) =>
          Array.from({ length: 24 }, (_, h) =>
            Math.round(
              Math.max(
                0,
                14 * Math.sin(((h - 7) / 24) * Math.PI * 2) + 10 + (d === 0 || d === 6 ? 6 : 0) + rnd() * 6,
              ),
            ),
          ),
        )
      : null,
    fetchedAt: Date.now(),
  };
}

const EVENT_COUNTS: [string, number][] = [
  ['embed_play', 640],
  ['stream_open', 520],
  ['dock_nav', 1900],
  ['talk_start', 380],
  ['talk_end', 250],
  ['talk_choice', 610],
  ['talk_goto', 90],
  ['talk_hide', 40],
  ['art_open', 330],
  ['clip_open', 300],
  ['song_play', 210],
  ['stream_search', 180],
  ['stream_filter', 160],
  ['time_open', 140],
  ['time_travel', 120],
  ['tour', 300],
  ['sys_toggle', 220],
  ['note_post', 130],
  ['note_report', 9],
  ['note_undo', 4],
  ['cwv', 1500],
  ['not_found', 25],
  ['outbound', 210],
  ['help_open', 60],
  ['log_open', 70],
  ['bgm_play', 150],
  ['event_open', 90],
  ['outfit_pick', 80],
  ['album_open', 35],
  ['clip_filter', 70],
  ['art_section', 110],
  ['disco_tab', 95],
];
export const previewEvents = async () => pairs(EVENT_COUNTS);

export async function previewValues(
  event: string,
  prop: string,
): Promise<{ value: string; total: number }[]> {
  reset(`${event}${prop}`);
  const L = await labels();
  const take = (ids: string[], scale: number) =>
    ids.slice(0, 8).map((value, i) => ({ value, total: Math.round(scale / (i + 1.4) + rnd() * 6) }));
  const key = `${event}.${prop}`;
  switch (key) {
    case 'embed_play.id':
    case 'song_play.id':
    case 'clip_open.id':
      return take(
        [...L.video.keys()].filter((_, i) => i % 37 === 3),
        220,
      );
    case 'stream_open.id':
      return take(
        [...L.stream.keys()].filter((_, i) => i % 41 === 5),
        180,
      );
    case 'art_open.id':
      return take(
        [...L.art.keys()].filter((_, i) => i % 9 === 2),
        120,
      );
    case 'event_open.id':
      return take(
        [...L.event.keys()].filter((_, i) => i % 5 === 1),
        60,
      );
    case 'talk_start.conv':
    case 'talk_end.conv':
      return take([...L.talk.keys()], key === 'talk_start.conv' ? 120 : 80);
    case 'talk_choice.choice':
      return take([...new Set([...L.talkChoice.keys()].map((k) => k.split('/')[1]!))], 90);
    case 'talk_goto.to':
    case 'dock_nav.to':
    case 'chapter_card.to':
      return take([...L.chapter.keys()], key === 'dock_nav.to' ? 600 : 40);
    case 'dock_nav.via':
      return [
        { value: 'click', total: 1500 },
        { value: 'key', total: 310 },
        { value: 'talk', total: 90 },
      ];
    case 'stream_search.q':
      return take(['マイクラ', 'minecraft', 'apex', '3D', 'karaoke', 'ホラー', 'mario kart', 'birthday'], 40);
    case 'stream_filter.year':
      return take(['2020', '2021', '2022', '2019', '2023', '2024'], 50);
    case 'time_travel.to':
      return take(['2020-08', '2018-08', '2021-03', '2022-12', '2024-08', 'present'], 30);
    case 'tour.done':
      return [
        { value: 'finish', total: 190 },
        { value: 'skip@dock', total: 70 },
        { value: 'skip@talk', total: 30 },
        { value: 'skip@time', total: 10 },
      ];
    case 'sys_toggle.what':
      return [
        { value: 'lang', total: 120 },
        { value: 'motion', total: 60 },
        { value: 'bgm', total: 40 },
      ];
    case 'note_post.status':
      return [
        { value: 'visible', total: 110 },
        { value: 'held', total: 12 },
        { value: 'error:RATE_LIMITED', total: 5 },
        { value: 'error:TURNSTILE', total: 3 },
      ];
    case 'note_report.reason':
      return [
        { value: 'spam', total: 5 },
        { value: 'other', total: 3 },
        { value: 'hate', total: 1 },
      ];
    case 'cwv.rating':
      return [
        { value: 'good', total: 1210 },
        { value: 'needs-improvement', total: 230 },
        { value: 'poor', total: 60 },
      ];
    case 'cwv.name':
      return [
        { value: 'LCP', total: 300 },
        { value: 'INP', total: 300 },
        { value: 'CLS', total: 300 },
        { value: 'FCP', total: 300 },
        { value: 'TTFB', total: 300 },
      ];
    case 'not_found.path':
      return take(['/stream', '/keeper/x', '/wp-login.php', '/clip', '/song'], 8);
    case 'outbound.host':
      return take(['www.youtube.com', 'x.com', 'hololive.hololivepro.com', 'shop.hololivepro.com'], 80);
    case 'outfit_pick.outfit':
      return take(['original-maid', 'new-year-kimono', 'casual-sailor', 'swimsuit'], 30);
    case 'bgm_play.id':
      return take(['aqua-iro-palette', 'kira-kira', 'for-the-win'], 60);
    case 'log_open.tab':
      return take(['log', 'credits'], 40);
    case 'disco_tab.tab':
      return take(['originals', 'covers', 'units', 'releases'], 40);
    case 'art_section.section':
      return take(['key-visuals', 'outfits', 'music', 'anniversary', 'collabs'], 40);
    case 'clip_filter.tag':
      return take(['funny', 'gaming', 'emotional', 'singing'], 30);
    case 'album_open.found':
      return take(['21', '15', '8', '3'], 12);
    default:
      return [];
  }
}

export const previewActive = () => 3 + Math.round(Math.random() * 4);
