import { createContext, useContext } from 'react';
import { toMeta, type City, type Gauge, type RegionData, type RegionJson, type StationsJson, type Water } from '../regions/model';

type Parts = { waters: Water[]; cities: City[]; globalRules: string[]; notices: Record<string, string>; gauges: Record<string, Gauge>; stations: StationsJson };
export const makeRegion = (j: RegionJson, { stations: s, ...d }: Parts): RegionData =>
  ({ ...toMeta(j), ...d, bbox: [s.bbox[0], s.bbox[1], s.bbox[2], s.bbox[3]], stations: s.stations, byId: new Map(d.waters.map((w) => [w.id, w])) });

/** The loaded region, available to every component under App. */
export const RegionContext = createContext<RegionData | null>(null);
export function useRegion(): RegionData {
  const r = useContext(RegionContext);
  if (!r) throw new Error('useRegion() outside RegionContext');
  return r;
}
