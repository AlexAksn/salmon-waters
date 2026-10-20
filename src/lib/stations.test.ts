import { describe, expect, it } from 'vitest';
import { GAUGES as G1 } from '../regions/r1/gauges';
import S1 from '../regions/r1/stations.json';
import { GAUGES as G2 } from '../regions/r2/gauges';
import S2 from '../regions/r2/stations.json';
import type { StationInfo, StationsJson } from '../regions/model';

// stations.json is generated from gauges.ts (npm run data:stations); this catches a gauge added without rerunning it.
describe.each([['r1', G1, S1 as StationsJson], ['r2', G2, S2 as StationsJson]])('%s stations.json', (_, gauges, s) => {
  it('has every gauge inside the bbox with 12 monthly means', () => {
    const [w, so, e, n] = s.bbox;
    for (const g of Object.values(gauges)) {
      const st: StationInfo | undefined = s.stations[g.stn];
      expect(st, g.stn).toBeDefined();
      expect(st.lon, g.stn).toBeGreaterThan(w); expect(st.lon, g.stn).toBeLessThan(e);
      expect(st.lat, g.stn).toBeGreaterThan(so); expect(st.lat, g.stn).toBeLessThan(n);
      expect(st.typ, g.stn).toHaveLength(12); expect(st.years, g.stn).toHaveLength(12);
    }
  });
});
