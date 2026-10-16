import { toMeta, type RegionData, type RegionMeta } from './model';
import r2 from './r2/region.json';

/** Every region the app knows. A region's rules load on demand (and its geometry from public/data/<id>/), so adding
 * one costs the others nothing. The first entry is the default. */
export interface RegionEntry extends RegionMeta { load: () => Promise<RegionData> }
export const REGIONS: RegionEntry[] = [
  { ...toMeta(r2), load: () => import('./r2').then((m) => m.region) },
];
export const DEFAULT_REGION = REGIONS[0].id;
export const regionEntry = (id: string | null | undefined) => REGIONS.find((r) => r.id === id);
