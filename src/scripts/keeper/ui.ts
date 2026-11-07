/**
 * Keeper browser components (docs/KEEPER-UPDATE-PLAN.md §7), adapted from the Kotoha admin's ui.js/analytics.js:
 * one element builder, toasts with icons, a shared dialog, KPIs, ranked bar lists, an SVG bar chart with a
 * hover / tap / arrow-key tooltip, and the 7 × 24 hour grid. Every piece of data goes in through textContent.
 */
import { num, numCompact, change } from '../../lib/keeper-format';

type Child = Node | string | null | undefined | false;
type Attrs = Record<string, string | number | boolean | null | undefined | ((e: Event) => void)>;

export function h<K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Attrs = {}, children: Child[] = []) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === null || v === undefined || v === false) continue;
    if (typeof v === 'function') node.addEventListener(k.replace(/^on/, ''), v);
    else if (k === 'text') node.textContent = String(v);
    else node.setAttribute(k, v === true ? '' : String(v));
  }
  for (const c of children) if (c !== null && c !== undefined && c !== false) node.append(c);
  return node;
}

const SVG = 'http://www.w3.org/2000/svg';
function s(
  tag: string,
  attrs: Record<string, string | number | null | undefined> = {},
  children: Node[] = [],
) {
  const node = document.createElementNS(SVG, tag);
  for (const [k, v] of Object.entries(attrs))
    if (v !== null && v !== undefined) node.setAttribute(k, String(v));
  node.append(...children);
  return node;
}
const sText = (attrs: Record<string, string | number>, text: string) => {
  const n = s('text', attrs);
  n.textContent = text;
  return n;
};

/** A sprite icon (#k-<name>, from KeeperIcons.astro). */
export function icon(name: string, cls = '') {
  const svg = s('svg', { class: `k-ico ${cls}`.trim(), 'aria-hidden': 'true', focusable: 'false' });
  svg.append(s('use', { href: `#k-${name}` }));
  return svg;
}

// ---------------------------------------------------------------- toasts
const TOAST_ICON = { ok: 'check-circle', error: 'warning-circle', info: 'info' } as const;
export type ToastOpts = { kind?: keyof typeof TOAST_ICON; undo?: () => void; ms?: number };
/** toast('Saved') · toast('Removed #12', () => undo()) · toast('Failed', { kind: 'error' }) */
export function toast(message: string, opts: ToastOpts | (() => void) = {}) {
  const o: ToastOpts = typeof opts === 'function' ? { undo: opts } : opts;
  const kind = o.kind ?? 'ok';
  const host = document.querySelector<HTMLElement>('[data-toasts]');
  if (!host) return;
  const box = h('div', { class: `k-toast k-toast--${kind}`, role: kind === 'error' ? 'alert' : 'status' }, [
    icon(TOAST_ICON[kind]),
    h('span', { text: message }),
  ]);
  if (o.undo) {
    const undo = o.undo;
    box.append(
      h('button', {
        class: 'k-btn',
        type: 'button',
        text: 'Undo',
        onclick: () => {
          undo();
          box.remove();
        },
      }),
    );
  }
  host.append(box);
  setTimeout(() => box.remove(), o.ms ?? (o.undo ? 5000 : 3500));
}

// ---------------------------------------------------------------- dialog
type DialogAction = { label: string; value: string; kind?: 'navy' | 'danger' | 'ghost' };
/** Opens the shared <dialog>. Resolves with the clicked action's value ('' when dismissed). */
export function openDialog(o: {
  title: string;
  icon?: string;
  body: Node[];
  actions: DialogAction[];
}): Promise<string> {
  const dlg = document.querySelector<HTMLDialogElement>('[data-dialog]')!;
  const form = dlg.querySelector('form')!;
  form.replaceChildren(
    h('h2', {}, [o.icon ? icon(o.icon) : null, h('span', { text: o.title })]),
    h('div', { class: 'k-dialog__body' }, o.body),
    h(
      'div',
      { class: 'k-dialog__actions' },
      o.actions.map((a) =>
        h('button', {
          class: `k-btn${a.kind && a.kind !== 'ghost' ? ` k-btn--${a.kind}` : ''}`,
          value: a.value,
          text: a.label,
        }),
      ),
    ),
  );
  return new Promise((resolve) => {
    dlg.addEventListener('close', () => resolve(dlg.returnValue === 'cancel' ? '' : dlg.returnValue), {
      once: true,
    });
    dlg.returnValue = '';
    dlg.showModal();
    form.querySelector<HTMLElement>('input, textarea, select, .k-btn--navy, .k-btn--danger')?.focus();
  });
}

/** Confirmation with an optional free-text reason or a typed confirmation (e.g. the crew number). */
export async function confirmAction(o: {
  title: string;
  message: string;
  confirm: string;
  danger?: boolean;
  reason?: { label: string; value?: string };
  typed?: { label: string; expect: string };
}): Promise<{ ok: boolean; reason: string }> {
  const reason = o.reason
    ? h('input', { class: 'k-input', value: o.reason.value ?? '', maxlength: 300 })
    : null;
  const typed = o.typed ? h('input', { class: 'k-input', inputmode: 'numeric', autocomplete: 'off' }) : null;
  const body: Node[] = [h('p', { text: o.message })];
  if (reason) body.push(h('label', { class: 'k-field' }, [h('span', { text: o.reason!.label }), reason]));
  if (typed) body.push(h('label', { class: 'k-field' }, [h('span', { text: o.typed!.label }), typed]));
  const value = await openDialog({
    title: o.title,
    icon: o.danger ? 'warning' : 'question',
    body,
    actions: [
      { label: 'Cancel', value: 'cancel' },
      { label: o.confirm, value: 'ok', kind: o.danger ? 'danger' : 'navy' },
    ],
  });
  if (value !== 'ok') return { ok: false, reason: '' };
  if (typed && typed.value.trim() !== o.typed!.expect) {
    toast('That did not match, so nothing was changed.', { kind: 'error' });
    return { ok: false, reason: '' };
  }
  return { ok: true, reason: reason?.value.trim() ?? '' };
}

// ---------------------------------------------------------------- states
export function stateBox(
  text: string,
  o: { kind?: 'empty' | 'error' | 'calm'; small?: boolean; retry?: () => void } = {},
) {
  const kind = o.kind ?? 'empty';
  return h(
    'div',
    {
      class: `k-state${o.small ? ' k-state--small' : ''}${kind !== 'empty' ? ` k-state--${kind}` : ''}`,
      role: kind === 'error' ? 'alert' : null,
    },
    [
      icon(kind === 'error' ? 'warning-circle' : kind === 'calm' ? 'check-circle' : 'anchor'),
      h('p', { text }),
      o.retry
        ? h('button', { class: 'k-btn k-btn--sm', type: 'button', text: 'Retry', onclick: o.retry })
        : null,
    ],
  );
}
export const skeleton = (height: number) =>
  h('div', { class: 'k-skel', style: `height:${height}px`, 'aria-hidden': 'true' });

// ---------------------------------------------------------------- KPIs and bar lists
export function kpi(o: {
  icon: string;
  label: string;
  value: string;
  sub?: string;
  now?: number;
  before?: number | null;
  /** how the number is counted, shown on hover */
  hint?: string;
}) {
  const c = o.now !== undefined ? change(o.now, o.before) : null;
  return h('div', { class: 'k-kpi', ...(o.hint ? { title: o.hint } : {}) }, [
    h('p', { class: 'k-kpi__label' }, [icon(o.icon), h('span', { text: o.label })]),
    h('p', { class: 'k-kpi__value', text: o.value }),
    o.sub || c
      ? h('p', { class: 'k-kpi__sub' }, [
          c
            ? h('span', {
                class: `k-change k-change--${c.dir}`,
                text: c.text,
                title: 'Compared with the previous period',
              })
            : null,
          o.sub ? h('span', { text: o.sub }) : null,
        ])
      : null,
  ]);
}

export type BarRow = { label: string; value: number; display?: string; hint?: string };
/** Ranked horizontal bars: rank · label · value, with a filled track. */
export function barList(
  rows: BarRow[],
  o: { tone?: 'pink' | 'navy' | 'teal'; empty?: string; limit?: number } = {},
) {
  const list = rows.filter((r) => r.value > 0).slice(0, o.limit ?? 10);
  if (!list.length) return stateBox(o.empty ?? 'No data yet.', { small: true });
  const max = Math.max(1, ...list.map((r) => r.value));
  return h(
    'ol',
    { class: `k-bars${o.tone && o.tone !== 'pink' ? ` k-bars--${o.tone}` : ''}` },
    list.map((r, i) =>
      h('li', { class: 'k-bars__row' }, [
        h('span', { class: 'k-bars__rank', text: String(i + 1), 'aria-hidden': 'true' }),
        h('span', { class: 'k-bars__label', title: r.label }, [
          r.label,
          r.hint ? h('small', { text: r.hint }) : null,
        ]),
        h('span', { class: 'k-bars__value', text: r.display ?? num(r.value) }),
        h('span', { class: 'k-bars__track', 'aria-hidden': 'true' }, [
          h('span', { class: 'k-bars__fill', style: `width:${Math.max(2, (r.value / max) * 100)}%` }),
        ]),
      ]),
    ),
  );
}

/** A card with an icon heading, an optional hint, and a body. */
export const statCard = (title: string, iconName: string, body: Node, hint?: string) =>
  h('section', { class: 'k-card' }, [
    h('h2', {}, [icon(iconName), h('span', { text: title })]),
    hint ? h('p', { class: 'k-card__sub', text: hint, style: 'margin:-4px 0 10px' }) : null,
    body,
  ]);
export const groupTitle = (text: string) => h('h3', { class: 'k-group-title' }, [h('span', { text })]);

// ---------------------------------------------------------------- bar chart
export type Point = { key: string; label: string; long: string; a: number; b: number };
/**
 * Bars for `a` (light) with `b` (dark) inside, drawn at the box's real width so ticks stay 11 px on every
 * screen. Hover, tap or ←/→ on the focused box shows one period's values. Redraws when the width changes.
 */
export function barChart(
  box: HTMLElement,
  points: Point[],
  o: { aLabel: string; bLabel: string; navy?: boolean },
) {
  const draw = () => {
    const W = Math.max(300, Math.round(box.clientWidth || 720));
    const H = W < 480 ? 190 : 230;
    const padL = 40;
    const padB = 26;
    const padT = 10;
    const max = Math.max(1, ...points.map((p) => p.a));
    const step = (W - padL) / Math.max(1, points.length);
    const barW = Math.max(3, Math.min(34, step * 0.68));
    const y = (v: number) => padT + (H - padT - padB) * (1 - v / max);
    const every = Math.max(1, Math.ceil(points.length / (W < 480 ? 5 : 10)));
    const nodes: Node[] = [];
    for (const f of [0.5, 1]) {
      nodes.push(s('line', { x1: padL, x2: W, y1: y(max * f), y2: y(max * f), class: 'k-chart__grid' }));
      nodes.push(
        sText(
          { x: padL - 8, y: y(max * f) + 4, 'text-anchor': 'end', class: 'k-chart__tick' },
          numCompact(Math.round(max * f)),
        ),
      );
    }
    nodes.push(s('line', { x1: padL, x2: W, y1: y(0), y2: y(0), class: 'k-chart__axis' }));
    nodes.push(sText({ x: padL - 8, y: y(0) + 4, 'text-anchor': 'end', class: 'k-chart__tick' }, '0'));
    const cols = points.map((p, i) => {
      const x = padL + i * step + (step - barW) / 2;
      const title = s('title');
      title.textContent = `${p.long}: ${num(p.a)} ${o.aLabel.toLowerCase()} · ${num(p.b)} ${o.bLabel.toLowerCase()}`;
      const col = s('g', { class: 'k-chart__col', 'data-i': i }, [
        title,
        s('rect', {
          x: padL + i * step,
          y: padT,
          width: step,
          height: H - padT - padB,
          rx: 6,
          class: 'k-chart__bg',
        }),
        s('rect', {
          x,
          y: y(p.a),
          width: barW,
          height: Math.max(0, y(0) - y(p.a)),
          rx: 3,
          class: 'k-chart__bar',
        }),
        s('rect', {
          x: x + barW * 0.2,
          y: y(p.b),
          width: barW * 0.6,
          height: Math.max(0, y(0) - y(p.b)),
          rx: 2,
          class: 'k-chart__bar k-chart__bar--inner',
        }),
        s('rect', { x: padL + i * step, y: 0, width: step, height: H, class: 'k-chart__hit' }),
      ]);
      nodes.push(col);
      const last = i === points.length - 1;
      if ((points.length - 1 - i) % every === 0)
        nodes.push(
          sText(
            {
              x: last ? W : padL + i * step + step / 2,
              y: H - 6,
              'text-anchor': last ? 'end' : 'middle',
              class: 'k-chart__tick',
            },
            p.label,
          ),
        );
      return { col, cx: padL + i * step + step / 2, top: y(p.a) };
    });
    const chart = s(
      'svg',
      {
        viewBox: `0 0 ${W} ${H}`,
        width: W,
        height: H,
        class: `k-chart${o.navy ? ' k-chart--navy' : ''}`,
        role: 'img',
        'aria-label': `${o.aLabel} and ${o.bLabel} per period`,
      },
      nodes,
    );
    const tip = h('div', { class: 'k-tip', hidden: true, 'aria-live': 'polite' });
    let active = -1;
    const show = (i: number) => {
      if (i < 0 || i >= points.length) return;
      cols[active]?.col.classList.remove('is-active');
      active = i;
      const { col, cx, top } = cols[i]!;
      col.classList.add('is-active');
      const p = points[i]!;
      tip.replaceChildren(
        h('strong', { text: p.long }),
        `${num(p.a)} ${o.aLabel.toLowerCase()} · ${num(p.b)} ${o.bLabel.toLowerCase()}`,
      );
      tip.hidden = false;
      const at = cx / W;
      tip.style.left = `${at * 100}%`;
      tip.style.top = `${(top / H) * 100}%`;
      tip.style.translate = `${at < 0.18 ? '-12%' : at > 0.82 ? '-88%' : '-50%'} calc(-100% - 8px)`;
    };
    const hide = () => {
      cols[active]?.col.classList.remove('is-active');
      active = -1;
      tip.hidden = true;
    };
    chart.addEventListener('pointerover', (e) => {
      const g = (e.target as Element).closest<SVGGElement>('.k-chart__col');
      if (g) show(Number(g.dataset.i));
    });
    box.onpointerleave = hide;
    box.onfocus = () => show(active < 0 ? points.length - 1 : active);
    box.onblur = hide;
    box.onkeydown = (e) => {
      if (e.key === 'ArrowLeft') show(Math.max(0, active - 1));
      else if (e.key === 'ArrowRight') show(Math.min(points.length - 1, active + 1));
      else return;
      e.preventDefault();
    };
    box.replaceChildren(chart, tip);
  };
  if (!points.length) {
    box.replaceChildren(stateBox('No data for this period yet.', { small: true }));
    return;
  }
  draw();
  let lastW = box.clientWidth;
  const ro = new ResizeObserver(() => {
    if (!box.isConnected) return ro.disconnect();
    if (Math.abs(box.clientWidth - lastW) > 30) {
      lastW = box.clientWidth;
      draw();
    }
  });
  ro.observe(box);
}

// ---------------------------------------------------------------- 7 × 24 grid
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
/** Busiest hours and days: rows = weekdays, columns = hours (keeper time). */
export function heatGrid(grid: number[][]) {
  const max = Math.max(1, ...grid.flat());
  let peak = { d: 0, hr: 0, v: -1 };
  grid.forEach((row, d) => row.forEach((v, hr) => v > peak.v && (peak = { d, hr, v })));
  const cells: Node[] = [
    h('span'),
    ...Array.from({ length: 24 }, (_, hr) => h('span', { text: hr % 6 === 0 ? String(hr) : '' })),
  ];
  grid.forEach((row, d) => {
    cells.push(h('span', { text: DAYS[d]! }));
    row.forEach((v, hr) =>
      cells.push(
        h('i', {
          style: `--v:${(v / max).toFixed(2)}`,
          title: `${DAYS[d]} ${hr}:00–${hr}:59 · ${num(v)} visits`,
        }),
      ),
    );
  });
  return h('div', {}, [
    h('div', { class: 'k-heat', role: 'img', 'aria-label': 'Visits by weekday and hour' }, cells),
    peak.v > 0
      ? h('p', {
          class: 'k-chart-note',
          text: `Busiest: ${DAYS[peak.d]} ${peak.hr}:00 (${num(peak.v)} visits)`,
        })
      : null,
  ]);
}

/** Segmented control from radio inputs. */
export function segmented(
  name: string,
  options: [string, string][],
  value: string,
  onChange: (v: string) => void,
  label: string,
) {
  return h(
    'div',
    { class: 'k-seg', role: 'radiogroup', 'aria-label': label },
    options.map(([v, text]) =>
      h('label', {}, [
        h('input', { type: 'radio', name, value: v, checked: v === value, onchange: () => onChange(v) }),
        h('span', { text }),
      ]),
    ),
  );
}

/** fetch() JSON with a "waking up" hint after 2.5 s. */
export async function getJSON<T>(url: string): Promise<T> {
  const slow = setTimeout(() => toast('Waking up the database…', { kind: 'info', ms: 6000 }), 2500);
  try {
    const r = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!r.ok)
      throw new Error(r.status === 401 ? 'Signed out — reload to sign in again.' : `Server said ${r.status}`);
    return (await r.json()) as T;
  } finally {
    clearTimeout(slow);
  }
}
