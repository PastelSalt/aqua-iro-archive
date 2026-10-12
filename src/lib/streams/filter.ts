/** Streaming filter (EXECUTIONPLAN §9.4): toggles `hidden` on prerendered rows. Must run < 16 ms for 639 rows. */
export type Row = {
  el: { hidden: boolean } | HTMLElement;
  id: string;
  year: number;
  tags: string[];
  views: number;
  sec: number;
  date: string;
};
export type Filter = { year: number | null; tags: string[]; ids: Set<string> | null };

/** A row matches when it is in the year (if any), has every selected tag, and is in the search hits (if any). */
export function matchesRow(r: Row, f: Filter): boolean {
  if (f.year !== null && r.year !== f.year) return false;
  for (const t of f.tags) if (!r.tags.includes(t)) return false;
  if (f.ids && !f.ids.has(r.id)) return false;
  return true;
}

export function applyFilter(rows: Row[], f: Filter): { count: number; seconds: number } {
  let count = 0;
  let seconds = 0;
  for (const r of rows) {
    const on = matchesRow(r, f);
    if (r.el.hidden === on) r.el.hidden = !on;
    if (on) {
      count++;
      seconds += r.sec;
    }
  }
  return { count, seconds };
}
