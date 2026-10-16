import { toMeta, type RegionData, type RegionMeta } from './model';
import r1 from './r1/region.json';
import r2 from './r2/region.json';

/** Every region the app has data for. A region's rules load on demand (and its geometry from public/data/<id>/), so
 * adding one costs the others nothing. */
export interface RegionEntry extends RegionMeta { load: () => Promise<RegionData> }
export const REGIONS: RegionEntry[] = [
  { ...toMeta(r2), load: () => import('./r2').then((m) => m.region) },
  { ...toMeta(r1), load: () => import('./r1').then((m) => m.region) },
];
export const regionEntry = (id: string | null | undefined) => REGIONS.find((r) => r.id === id);

/** The other DFO regions, for the BC overview: not mapped yet, with what their DFO page says in one line. */
export interface RegionStub { num: number; name: string; dfoUrl: string; note: string }
export const dfoPageUrl = (num: number) => `https://www.pac.dfo-mpo.gc.ca/fm-gp/rec/fresh-douce/region${num}-eng.html`;
const STUBS: RegionStub[] = [
  { num: 3, name: 'Thompson-Nicola', note: 'Not mapped yet. DFO lists chinook openings in late August and September on Kamloops Lake, the South Thompson and the Thompson; everything else is closed.' },
  { num: 4, name: 'Kootenay', note: 'DFO: non-retention of salmon in all Region 4 waters.' },
  { num: 5, name: 'Cariboo', note: 'DFO lists no salmon openings for Region 5.' },
  { num: 6, name: 'Skeena', note: 'Not mapped yet. The largest table in BC, about 100 waters, mostly closures by section.' },
  { num: 7, name: 'Omineca-Peace', note: 'DFO lists one water: the Nechako River at Prince George, sockeye and pink, Aug 22 to Sep 21.' },
  { num: 8, name: 'Okanagan', note: 'Not mapped yet. DFO lists chinook on Mabel Lake and the lower Shuswap River Aug 16 to Sep 12; sockeye closed on Osoyoos Lake.' },
].map((s) => ({ ...s, dfoUrl: dfoPageUrl(s.num) }));
/** All eight DFO regions in number order: a RegionEntry (mapped) or a RegionStub. */
export const BC_REGIONS: (RegionEntry | RegionStub)[] = [...REGIONS, ...STUBS].sort((a, b) => a.num - b.num);
export const isMapped = (r: RegionEntry | RegionStub): r is RegionEntry => 'load' in r;
