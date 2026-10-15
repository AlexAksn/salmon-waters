import { isoLocal, parseIso, sameDay, SPECIES_PICKS, type SpeciesPick } from './rules';
import { BASEMAPS, type Basemap } from './basemaps';

export interface UrlState { date: Date; sp: SpeciesPick; sel: string | null; base: Basemap }
const SP = SPECIES_PICKS.map((s) => s.id);
const BM = BASEMAPS.map((b) => b.id);

export function readUrl(): Partial<UrlState> {
  const q = new URLSearchParams(location.search);
  const out: Partial<UrlState> = {};
  const d = q.get('d'); if (d) { const p = parseIso(d); if (p) out.date = p; }
  const sp = q.get('sp') as SpeciesPick | null; if (sp && SP.includes(sp)) out.sp = sp;
  const w = q.get('w'); if (w) out.sel = w;
  const b = q.get('b') as Basemap | null; if (b && BM.includes(b)) out.base = b;
  return out;
}
export function writeUrl(s: UrlState) {
  const q = new URLSearchParams();
  if (!sameDay(s.date, new Date())) q.set('d', isoLocal(s.date));
  if (s.sp !== 'any') q.set('sp', s.sp);
  if (s.sel) q.set('w', s.sel);
  if (s.base !== 'chart') q.set('b', s.base);
  const qs = q.toString();
  history.replaceState(null, '', qs ? `?${qs}` : location.pathname);
}
