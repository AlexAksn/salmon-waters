import { WATERS, type Rule, type Species, type Water } from '../data/regs';

export type Status = 'open' | 'cr' | 'closed' | 'none' | 'tidal';
export type SpeciesPick = 'any' | 'chinook' | 'coho';
export type Fish = 'chinook' | 'coho';
export const FISH: Fish[] = ['chinook', 'coho'];
export const SPECIES_PICKS: { id: SpeciesPick; label: string }[] = [
  { id: 'any', label: 'Any salmon' }, { id: 'chinook', label: 'Chinook' }, { id: 'coho', label: 'Coho' },
];
export const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const SPN: Record<Species, string> = { chinook: 'Chinook', coho: 'Coho', all: 'All species' };
export const STATUS_LABEL: Record<Status, string> = {
  open: 'Open', cr: 'Catch & release', closed: 'Closed', none: 'Not listed', tidal: 'Tidal water',
};
export const STATUS_ORDER: Record<Status, number> = { open: 0, cr: 1, closed: 2, none: 3, tidal: 4 };
/** CSS status class for a rule kind (gear rules use the tidal hue). */
export const KIND_STATUS: Record<Rule['kind'], Status | 'gear'> = { keep: 'open', nr: 'cr', closed: 'closed', gear: 'gear' };

export const WATER_BY_ID: ReadonlyMap<string, Water> = new Map(WATERS.map((w) => [w.id, w]));
/** Unlisted rivers are drawn thin and kept behind a toggle; tidal and listed waters share the main list. */
export const isUnlisted = (w: Water) => w.elsewhere?.status === 'none';

// ---- date windows ----
const md = (d: Date) => (d.getMonth() + 1) * 100 + d.getDate();
const keyCache = new Map<string, number>();
/** "MM-DD" -> MMDD, parsed once per distinct string. */
function pk(s: string) {
  let k = keyCache.get(s);
  if (k === undefined) { k = parseInt(s.slice(0, 2), 10) * 100 + parseInt(s.slice(3, 5), 10); keyCache.set(s, k); }
  return k;
}
/** Is rule r in force on date d? Handles wrap-around windows and open-ended ("until further notice"). */
export function active(r: Rule, d: Date): boolean {
  if (r.to == null) return true;
  const k = md(d), f = pk(r.from), t = pk(r.to);
  return f <= t ? k >= f && k <= t : k >= f || k <= t;
}
export const activeRules = (w: Water, d: Date): Rule[] => w.rules.filter((r) => active(r, d));

// ---- one day's rules, digested once and shared by cards, detail, status and "changing soon" ----
export interface FishDay { keep: Rule[]; nr: Rule[] }
export interface DaySummary { closed?: Rule; fish: Record<Fish, FishDay>; gear: Rule[] }
export function daySummary(w: Water, d: Date): DaySummary {
  const act = activeRules(w, d);
  const fish = { chinook: { keep: [], nr: [] }, coho: { keep: [], nr: [] } } as Record<Fish, FishDay>;
  for (const r of act) {
    if (r.sp === 'all') continue;
    if (r.kind === 'keep') fish[r.sp].keep.push(r); else if (r.kind === 'nr') fish[r.sp].nr.push(r);
  }
  return { closed: act.find((r) => r.kind === 'closed'), fish, gear: act.filter((r) => r.kind === 'gear') };
}
const fishStatus = (f: FishDay): Status => (f.keep.length ? 'open' : f.nr.length ? 'cr' : 'none');
export function statusOf(w: Water, d: Date, sp: SpeciesPick): Status {
  if (w.elsewhere) return w.elsewhere.status;
  const s = daySummary(w, d);
  if (s.closed) return 'closed';
  const picks = sp === 'any' ? FISH : [sp];
  const st = picks.map((f) => fishStatus(s.fish[f]));
  return st.includes('open') ? 'open' : st.includes('cr') ? 'cr' : 'none';
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
export interface RulePart { sp: Fish; text: string }
export interface RuleLine { closed?: string; parts: RulePart[]; gear: string[] }
export function ruleLine(w: Water, d: Date, sp: SpeciesPick): RuleLine {
  const s = daySummary(w, d);
  if (s.closed) return { closed: s.closed.limit || 'No fishing for salmon', parts: [], gear: [] };
  const parts: RulePart[] = [];
  for (const f of sp === 'any' ? FISH : [sp]) {
    const fd = s.fish[f];
    if (fd.keep.length) parts.push({ sp: f, text: fd.keep.map((r) => r.limit).join('; ') });
    else if (fd.nr.length) parts.push({ sp: f, text: 'catch & release' });
    else if (sp !== 'any') parts.push({ sp: f, text: 'closed' });
  }
  return { parts, gear: s.gear.map((r) => r.limit!) };
}

// ---- season strip: depends only on (water, species, year), so compute once ----
export interface Run { st: Status; start: number; n: number }
const runCache = new Map<string, Run[]>();
export function seasonRuns(w: Water, sp: SpeciesPick, year: number): Run[] {
  const key = `${w.id}|${sp}|${year}`;
  let runs = runCache.get(key);
  if (runs) return runs;
  runs = [];
  let cur: Run | null = null;
  for (let i = 0; i < 365; i++) {
    const st = statusOf(w, new Date(year, 0, 1 + i), sp);
    if (cur && cur.st === st) cur.n++;
    else { cur = { st, start: i, n: 1 }; runs.push(cur); }
  }
  runCache.set(key, runs);
  return runs;
}

// ---- what changes in the next N days ----
export type Change = { kind: 'sp'; sp: Fish; from: Status; to: Status; limit?: string } | { kind: 'gear'; from: string; to: string };
export interface UpcomingEvent { d: Date; w: Water; ch: Change[] }
interface Sig { chinook: Status; coho: Status; gear: string }
function sig(w: Water, d: Date): Sig {
  const s = daySummary(w, d);
  const st = (f: Fish): Status => (s.closed ? 'closed' : fishStatus(s.fish[f]));
  return { chinook: st('chinook'), coho: st('coho'), gear: s.gear.map((r) => r.limit).sort().join(', ') };
}
export function upcoming(from: Date, days: number, waters: Water[]): UpcomingEvent[] {
  const ev: UpcomingEvent[] = [];
  for (const w of waters) {
    if (w.elsewhere) continue;
    let prev = sig(w, from);
    for (let i = 1; i <= days; i++) {
      const d = addDays(from, i);
      const cur = sig(w, d);
      const ch: Change[] = [];
      for (const f of FISH) {
        if (cur[f] === prev[f]) continue;
        const fd = daySummary(w, d).fish[f];
        ch.push({ kind: 'sp', sp: f, from: prev[f], to: cur[f], limit: (fd.keep[0] ?? fd.nr[0])?.limit });
      }
      if (cur.gear !== prev.gear) ch.push({ kind: 'gear', from: prev.gear, to: cur.gear });
      if (ch.length) ev.push({ d, w, ch });
      prev = cur;
    }
  }
  return ev.sort((x, y) => x.d.getTime() - y.d.getTime() || x.w.name.localeCompare(y.w.name));
}
