import { FISH, isoLocal, parseIso, sameDay, type SpeciesPick } from './rules';
import { BASEMAPS, type Basemap } from './basemaps';
import { regionEntry } from '../regions';

/** ?r=&d=&sp=&w=&b= — region (none = the BC overview), date, species, selected water, basemap. Defaults are left out. */
export interface UrlState { region: string | null; date: Date; sp: SpeciesPick; sel: string | null; base: Basemap }
const SP: SpeciesPick[] = ['any', ...FISH];
const BM = BASEMAPS.map((b) => b.id);

export function readUrl(): Partial<UrlState> {
  const q = new URLSearchParams(location.search);
  const out: Partial<UrlState> = {};
  const r = q.get('r'); if (r && regionEntry(r)) out.region = r;
  const d = q.get('d'); if (d) { const p = parseIso(d); if (p) out.date = p; }
  const sp = q.get('sp') as SpeciesPick | null; if (sp && SP.includes(sp)) out.sp = sp;
  const w = q.get('w'); if (w) out.sel = w;
  const b = q.get('b') as Basemap | null; if (b && BM.includes(b)) out.base = b;
  return out;
}
/** Rewrites the current history entry; a region change pushes a new entry first (App.switchRegion). */
export function writeUrl(s: UrlState) {
  const q = new URLSearchParams();
  if (s.region) q.set('r', s.region);
  if (!sameDay(s.date, new Date())) q.set('d', isoLocal(s.date));
  if (s.sp !== 'any') q.set('sp', s.sp);
  if (s.sel) q.set('w', s.sel);
  if (s.base !== 'chart') q.set('b', s.base);
  const qs = q.toString();
  history.replaceState(null, '', qs ? `?${qs}` : location.pathname);
}
