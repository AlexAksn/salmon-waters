import type { Rule, Species, Unlisted, Water } from '../data/regs';

export type Status = 'open' | 'cr' | 'closed' | 'none' | 'tidal';
export type SpeciesPick = 'any' | 'chinook' | 'coho';
export type AnyWater = Water | Unlisted;
export const isUnlisted = (w: AnyWater): w is Unlisted => 'zone' in w;

export const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const SPN: Record<Species, string> = { chinook: 'Chinook', coho: 'Coho', all: 'All species' };
export const STATUS_LABEL: Record<Status, string> = {
  open: 'Open', cr: 'Catch & release', closed: 'Closed', none: 'Not listed', tidal: 'Tidal water',
};
export const STATUS_ORDER: Record<Status, number> = { open: 0, cr: 1, closed: 2, none: 3, tidal: 4 };

const md = (d: Date) => (d.getMonth() + 1) * 100 + d.getDate();
const pk = (s: string) => parseInt(s.slice(0, 2), 10) * 100 + parseInt(s.slice(3, 5), 10);

/** Is rule r in force on date d? Handles wrap-around windows and open-ended ("until further notice"). */
export function active(r: Rule, d: Date): boolean {
  if (r.to == null) return true;
  const k = md(d), f = pk(r.from), t = pk(r.to);
  return f <= t ? k >= f && k <= t : k >= f || k <= t;
}
export const spMatch = (r: Rule, sp: SpeciesPick) => (sp === 'any' ? r.sp !== 'all' : r.sp === sp);
export const activeRules = (w: AnyWater, d: Date): Rule[] => (isUnlisted(w) ? [] : w.rules.filter((r) => active(r, d)));

export function statusOf(w: AnyWater, d: Date, sp: SpeciesPick): Status {
  if (isUnlisted(w)) return 'none';
  if (w.kind === 'tidal') return 'tidal';
  const act = activeRules(w, d);
  if (act.some((r) => r.kind === 'closed')) return 'closed';
  if (act.some((r) => r.kind === 'keep' && spMatch(r, sp))) return 'open';
  if (act.some((r) => r.kind === 'nr' && spMatch(r, sp))) return 'cr';
  return 'none';
}

// ---- dates ----
export const fmtDate = (d: Date) => `${MON[d.getMonth()]} ${d.getDate()}`;
export const fmtMD = (s: string) => `${MON[parseInt(s.slice(0, 2), 10) - 1]} ${parseInt(s.slice(3, 5), 10)}`;
export function isoLocal(d: Date) {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
export function parseIso(s: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return null;
  const d = new Date(+m[1], +m[2] - 1, +m[3]);
  return isNaN(d.getTime()) ? null : d;
}
export const sameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
export function addDays(d: Date, n: number) { const x = new Date(d); x.setDate(x.getDate() + n); return x; }
export const dayOfYear = (d: Date) => Math.round((d.getTime() - new Date(d.getFullYear(), 0, 1).getTime()) / 864e5);

// ---- one-line summary for a card ----
export interface RulePart { sp: 'chinook' | 'coho'; status: Status; text: string }
export interface RuleLine { closed?: string; parts: RulePart[]; gear: string[] }
export function ruleLine(w: Water, d: Date, sp: SpeciesPick): RuleLine {
  const act = activeRules(w, d);
  const closed = act.find((r) => r.kind === 'closed');
  if (closed) return { closed: closed.limit || 'No fishing for salmon', parts: [], gear: [] };
  const parts: RulePart[] = [];
  (['chinook', 'coho'] as const).forEach((s) => {
    if (sp !== 'any' && sp !== s) return;
    const keep = act.filter((r) => r.sp === s && r.kind === 'keep');
    const nr = act.filter((r) => r.sp === s && r.kind === 'nr');
    if (keep.length) parts.push({ sp: s, status: 'open', text: keep.map((r) => r.limit).join('; ') });
    else if (nr.length) parts.push({ sp: s, status: 'cr', text: 'catch & release' });
    else if (sp !== 'any') parts.push({ sp: s, status: 'none', text: 'closed' });
  });
  return { parts, gear: act.filter((r) => r.kind === 'gear').map((r) => r.limit!) };
}

// ---- season strip ----
export interface Run { st: Status; start: number; n: number }
export function seasonRuns(w: AnyWater, sp: SpeciesPick, year: number): Run[] {
  const runs: Run[] = [];
  let cur: Run | null = null;
  for (let i = 0; i < 365; i++) {
    const st = statusOf(w, new Date(year, 0, 1 + i), sp);
    if (cur && cur.st === st) cur.n++;
    else { cur = { st, start: i, n: 1 }; runs.push(cur); }
  }
  return runs;
}

// ---- what changes in the next N days ----
export interface Change { sp?: 'chinook' | 'coho'; gear?: boolean; from: string; to: string; limit?: string }
export interface UpcomingEvent { d: Date; w: Water; ch: Change[] }
const sig = (w: Water, d: Date) =>
  `${statusOf(w, d, 'chinook')}|${statusOf(w, d, 'coho')}|${activeRules(w, d).filter((r) => r.kind === 'gear').map((r) => r.limit).sort().join(',')}`;
export function upcoming(from: Date, days: number, waters: Water[]): UpcomingEvent[] {
  const ev: UpcomingEvent[] = [];
  waters.filter((w) => w.kind !== 'tidal').forEach((w) => {
    let prev = sig(w, from);
    for (let i = 1; i <= days; i++) {
      const d = addDays(from, i);
      const s = sig(w, d);
      if (s === prev) continue;
      const a = prev.split('|'), b = s.split('|');
      const ch: Change[] = [];
      (['chinook', 'coho'] as const).forEach((sp, k) => {
        if (a[k] !== b[k]) {
          const rule = activeRules(w, d).find((r) => r.sp === sp && (r.kind === 'keep' || r.kind === 'nr'));
          ch.push({ sp, from: a[k], to: b[k], limit: rule?.limit });
        }
      });
      if (a[2] !== b[2]) ch.push({ gear: true, from: a[2], to: b[2] });
      ev.push({ d, w, ch });
      prev = s;
    }
  });
  return ev.sort((x, y) => x.d.getTime() - y.d.getTime() || x.w.name.localeCompare(y.w.name));
}
