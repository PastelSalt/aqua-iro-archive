/**
 * Visitor statistics for the Keeper (docs/KEEPER-UPDATE-PLAN.md §6.1–6.2), after the Kotoha admin's analytics.js:
 * fixed-period KPIs, the visits chart with Daily / Weekly / Monthly, then a "Details for" range bar directly
 * above everything it changes, and breakdowns grouped Audience / Traffic / Engagement. `full` is the Visitors
 * page (every list to 25 rows, OS and language, the 7 × 24 grid); the dashboard shows the top rows.
 */
import { num, duration, pct, KEEPER_TZ_LABEL } from '../../lib/keeper-format';
import {
  h,
  icon,
  kpi,
  barList,
  barChart,
  heatGrid,
  statCard,
  groupTitle,
  segmented,
  stateBox,
  skeleton,
  getJSON,
  type BarRow,
  type Point,
} from './ui';

type Metric = { x: string; y: number };
type Stats = Record<'visitors' | 'visits' | 'pageviews' | 'bounces' | 'totaltime', number> & {
  prev: Record<string, number | null>;
};
type Visitors = {
  error?: string;
  stats: Stats;
  periods: Record<'today' | 'week' | 'month', Stats>;
  unit: 'day' | 'week' | 'month';
  series: { pageviews: Metric[]; sessions: Metric[] };
  paths: Metric[];
  referrers: Metric[];
  countries: Metric[];
  devices: Metric[];
  browsers: Metric[];
  os: Metric[];
  languages: Metric[];
  weekly: number[][] | null;
  fetchedAt: number;
};
type TopCard = {
  title: string;
  icon: string;
  hint?: string;
  rows: BarRow[];
  tone?: 'pink' | 'navy' | 'teal';
};
export type StatsResponse = {
  configured: boolean;
  board: { series: { day: string; notes: number; reports: number }[] };
  visitors: Visitors | { error: string } | null;
  top: TopCard[] | null;
};

const DEVICE: Record<string, string> = {
  mobile: 'Phone',
  desktop: 'Computer',
  laptop: 'Laptop',
  tablet: 'Tablet',
};
const BROWSER: Record<string, string> = {
  chrome: 'Chrome',
  crios: 'Chrome (iPhone)',
  ios: 'Safari (iPhone)',
  'ios-webview': 'In-app (iPhone)',
  safari: 'Safari',
  'edge-chromium': 'Edge',
  edge: 'Edge',
  firefox: 'Firefox',
  fxios: 'Firefox (iPhone)',
  samsung: 'Samsung Internet',
  opera: 'Opera',
  android: 'Android browser',
  'chromium-webview': 'In-app (Android)',
  facebook: 'Facebook app',
  instagram: 'Instagram app',
  line: 'LINE app',
};
const regionName = (() => {
  try {
    const d = new Intl.DisplayNames(['en'], { type: 'region' });
    return (c: string) => (/^[A-Z]{2}$/.test(c) ? (d.of(c) ?? c) : 'Unknown');
  } catch {
    return (c: string) => c;
  }
})();
const langName = (() => {
  try {
    const d = new Intl.DisplayNames(['en'], { type: 'language' });
    return (c: string) => (c ? (d.of(c) ?? c) : 'Unknown');
  } catch {
    return (c: string) => c;
  }
})();
const UNIT_LABEL = { day: 'Daily', week: 'Weekly', month: 'Monthly' } as const;
const RANGES: [string, string][] = [
  ['7d', '7 days'],
  ['30d', '30 days'],
  ['90d', '90 days'],
  ['1y', '1 year'],
];
const rows = (m: Metric[], label: (x: string) => string = (x) => x): BarRow[] =>
  m.map((r) => ({ label: label(r.x), value: r.y }));

function periodLabel(unit: Visitors['unit'], x: string) {
  const d = new Date(x.length === 7 ? `${x}-01T00:00:00` : x.replace(' ', 'T'));
  if (Number.isNaN(d.getTime())) return { label: x, long: x };
  if (unit === 'month')
    return {
      label: d.toLocaleString('en-US', { month: 'short' }),
      long: d.toLocaleString('en-US', { month: 'long', year: 'numeric' }),
    };
  const label = d.toLocaleString('en-US', { month: 'numeric', day: 'numeric' });
  const long = d.toLocaleString('en-US', {
    weekday: unit === 'day' ? 'short' : undefined,
    month: 'short',
    day: 'numeric',
  });
  return { label, long: unit === 'week' ? `Week of ${long}` : long };
}

/** Notes & reports per day for the board section (navy chart). */
export function boardChart(box: HTMLElement, series: StatsResponse['board']['series']) {
  const pts: Point[] = series.map((s) => {
    const d = new Date(`${s.day}T00:00:00`);
    return {
      key: s.day,
      label: d.toLocaleString('en-US', { month: 'numeric', day: 'numeric' }),
      long: d.toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
      a: s.notes,
      b: s.reports,
    };
  });
  barChart(box, pts, { aLabel: 'Notes', bLabel: 'Reports', navy: true });
}

export function renderVisitors(
  host: HTMLElement,
  o: { full: boolean; pageTitles: Record<string, string>; onBoard?: (r: StatsResponse) => void },
) {
  let range = o.full ? '30d' : '7d';
  let unit: Visitors['unit'] = 'day';

  const head = (note?: string) =>
    h('div', { class: 'k-block-head' }, [
      // on the Visitors page the page title already says it
      o.full
        ? h('span')
        : h('h2', { class: 'k-ticket k-ticket--sm k-ticket--pink' }, [
            icon('chart-bar'),
            h('span', { text: 'Visitors' }),
          ]),
      h('p', {
        class: 'k-block-head__note',
        text: note ?? `Counted by the site itself · times in ${KEEPER_TZ_LABEL} · weeks start on Monday`,
      }),
    ]);

  const draw = (r: StatsResponse) => {
    o.onBoard?.(r);
    if (!r.configured) {
      host.replaceChildren(head(), stateBox('Visitor stats are off.', { kind: 'empty' }));
      return;
    }
    const v = r.visitors as Visitors | { error: string } | null;
    if (!v || 'error' in v) {
      host.replaceChildren(
        head(),
        stateBox(`The visitor numbers could not load (${(v as { error?: string })?.error ?? 'no data'}).`, {
          kind: 'error',
          retry: load,
        }),
      );
      return;
    }
    const s = v.stats;
    const P = v.periods;
    const updated = Math.round((Date.now() - v.fetchedAt) / 60000);

    // the visits chart: pageviews (light) with visitors (dark) per period
    const chartBox = h('div', {
      class: 'k-chart-box',
      tabindex: '0',
      'aria-label': 'Visits chart: use the left and right arrow keys to read each period',
    });
    const pts: Point[] = v.series.pageviews.map((p, i) => ({
      key: p.x,
      ...periodLabel(v.unit, p.x),
      a: p.y,
      b: v.series.sessions[i]?.y ?? 0,
    }));
    const total = h('p', {
      class: 'k-card__sub',
      text: `${num(pts.reduce((a, p) => a + p.a, 0))} page views · ${num(pts.reduce((a, p) => a + p.b, 0))} visitors in this chart`,
    });

    const perVisit = (x: Stats) => (x.visits ? x.totaltime / x.visits : 0);
    const bounce = (x: Stats) => (x.visits ? Math.round((x.bounces / x.visits) * 100) : 0);
    const prevBounce =
      s.prev.visits && s.prev.bounces !== null ? Math.round((s.prev.bounces! / s.prev.visits) * 100) : null;
    const jp = v.countries.find((c) => c.x === 'JP')?.y ?? 0;
    const known = v.countries.reduce((a, c) => a + c.y, 0);
    const oneCountry = v.countries.length === 1 && known > 20;
    const limit = o.full ? 25 : 6;
    const pageLabel = (p: string) => o.pageTitles[p.replace(/\/$/, '') || '/'] ?? p;

    host.replaceChildren(
      head(
        `Counted by the site itself · times in ${KEEPER_TZ_LABEL} · updated ${updated ? `${updated} min ago` : 'just now'}`,
      ),
      h('div', { class: 'k-kpis' }, [
        kpi({
          icon: 'sun',
          label: 'Today',
          value: num(P.today.visits),
          sub: `${num(P.today.visitors)} visitors · ${num(P.today.pageviews)} page views`,
        }),
        kpi({
          icon: 'calendar-dots',
          label: 'This week',
          value: num(P.week.visits),
          sub: `${num(P.week.visitors)} visitors · ${num(P.week.pageviews)} page views`,
        }),
        kpi({
          icon: 'calendar',
          label: 'This month',
          value: num(P.month.visits),
          sub: `${num(P.month.visitors)} visitors · ${num(P.month.pageviews)} page views`,
        }),
      ]),
      h('section', { class: 'k-card' }, [
        h('div', { class: 'k-card__head' }, [
          h('div', {}, [h('h2', {}, [icon('chart-line-up'), h('span', { text: 'Visits' })]), total]),
          segmented(
            'k-unit',
            (['day', 'week', 'month'] as const).map((u) => [u, UNIT_LABEL[u]]),
            unit,
            (u) => {
              unit = u as Visitors['unit'];
              void load();
            },
            'Chart period',
          ),
        ]),
        chartBox,
        h('p', { class: 'k-legend' }, [
          h('span', {}, [h('i'), 'Page views']),
          h('span', {}, [h('i', { class: 'is-inner' }), 'Visitors']),
        ]),
      ]),
      h('div', { class: 'k-range' }, [
        h('h2', {}, [icon('sliders-horizontal'), h('span', { text: 'Details for' })]),
        segmented(
          'k-range',
          RANGES,
          range,
          (x) => {
            range = x;
            void load();
          },
          'Details for',
        ),
        h('p', {
          text: `${num(s.visits)} visits · ${num(s.visitors)} visitors · ${num(s.pageviews)} page views in this period`,
        }),
      ]),
      h('div', { class: 'k-kpis k-kpis--navy' }, [
        kpi({
          icon: 'timer',
          label: 'Average visit',
          value: duration(perVisit(s)),
          now: perVisit(s),
          before: s.prev.visits ? (s.prev.totaltime ?? 0) / s.prev.visits : null,
          sub: 'per visit',
        }),
        kpi({
          icon: 'arrow-counter-clockwise',
          label: 'Bounce rate',
          value: `${bounce(s)}%`,
          now: bounce(s),
          before: prevBounce,
          sub: 'left after one page',
        }),
        kpi({
          icon: 'note',
          label: 'Pages per visit',
          value: s.visits ? (s.pageviews / s.visits).toFixed(1) : '—',
          sub: 'average',
        }),
        kpi({
          icon: 'users',
          label: 'Visitors',
          value: num(s.visitors),
          now: s.visitors,
          before: s.prev.visitors,
          sub: 'unique, in this period',
        }),
      ]),
      groupTitle('Audience'),
      h('div', { class: 'k-grid' }, [
        statCard(
          'Devices',
          'device-mobile',
          barList(
            rows(v.devices, (x) => DEVICE[x] ?? x),
            { limit },
          ),
        ),
        statCard(
          'Browsers',
          'globe',
          barList(
            rows(v.browsers, (x) => BROWSER[x] ?? x),
            { limit },
          ),
        ),
        statCard(
          'Countries',
          'map-pin',
          h('div', {}, [
            h('p', {
              class: 'k-card__sub',
              style: 'margin:-4px 0 10px',
              text: known ? `${pct(jp, known)} of visits came from Japan.` : '',
            }),
            oneCountry
              ? h('p', {
                  class: 'k-err',
                  style: 'margin-bottom:10px',
                  text: 'Every visit shows one country: the visitor location may not be passed through the /s proxy.',
                })
              : null,
            barList(rows(v.countries, regionName), { limit }),
          ]),
        ),
        o.full ? statCard('Languages', 'translate', barList(rows(v.languages, langName), { limit })) : null,
        o.full ? statCard('Operating systems', 'monitor', barList(rows(v.os), { limit })) : null,
      ]),
      groupTitle('Traffic'),
      h('div', { class: 'k-grid' }, [
        statCard(
          'Where visits come from',
          'link',
          barList(
            rows(v.referrers, (x) => x || 'Direct or unknown'),
            { limit, tone: 'navy' },
          ),
        ),
        statCard('Top pages', 'note', barList(rows(v.paths, pageLabel), { limit, tone: 'navy' })),
        o.full && v.weekly
          ? statCard(
              'Busiest hours and days',
              'clock',
              heatGrid(v.weekly),
              `${KEEPER_TZ_LABEL}, ${RANGES.find((x) => x[0] === range)?.[1] ?? range}`,
            )
          : null,
      ]),
      ...(o.full || !r.top?.length
        ? []
        : [
            groupTitle('Engagement'),
            h('div', { class: 'k-grid' }, [
              ...r.top.map((c) =>
                statCard(c.title, c.icon, barList(c.rows, { tone: c.tone, limit: 5 }), c.hint),
              ),
            ]),
            h('p', { class: 'k-bars__more' }, [
              h('a', { href: '/keeper/insights', text: 'See every archive insight →' }),
            ]),
          ]),
    );
    barChart(chartBox, pts, { aLabel: 'Page views', bLabel: 'Visitors' });
  };

  async function load() {
    host.setAttribute('aria-busy', 'true');
    try {
      draw(
        await getJSON<StatsResponse>(
          `/api/admin/stats?range=${range}&unit=${unit}${o.full ? '&full=1' : ''}`,
        ),
      );
    } catch (e) {
      host.replaceChildren(head(), stateBox((e as Error).message, { kind: 'error', retry: load }));
    } finally {
      host.removeAttribute('aria-busy');
    }
  }
  // first load: placeholders at the final size so nothing jumps
  host.replaceChildren(
    head(),
    h('div', { class: 'k-kpis' }, [skeleton(96), skeleton(96), skeleton(96)]),
    skeleton(300),
  );
  void load();
}
