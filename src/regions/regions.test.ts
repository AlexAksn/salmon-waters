import { describe, expect, it } from 'vitest';
import { BC_REGIONS, dfoPageUrl, isMapped, REGIONS, regionEntry } from './index';
import r2 from './r2/region.json';

describe('regions', () => {
  it('every region loads with consistent data', async () => {
    for (const r of REGIONS) {
      const d = await r.load();
      expect(d.id).toBe(r.id);
      expect(d.waters.length).toBeGreaterThan(0);
      for (const w of d.waters) expect(d.byId.get(w.id)).toBe(w);
      for (const id of Object.keys(d.gauges)) expect(d.byId.has(id), `gauge for unknown water ${id}`).toBe(true);
      for (const w of d.waters) for (const rule of w.rules) if (rule.notice) expect(d.notices[rule.notice], `${w.id} cites ${rule.notice}`).toBeTruthy();
    }
  });
  it('notice patterns name real waters', async () => {
    const d = await regionEntry('r2')!.load();
    for (const id of Object.keys(r2.notices.waters)) expect(d.byId.has(id), id).toBe(true);
  });
  it('looks regions up by id', () => { expect(regionEntry('r2')?.num).toBe(2); expect(regionEntry('nope')).toBeUndefined(); });
  it('mapped regions point at the same DFO pages the stubs derive', () => { for (const r of REGIONS) expect(r.dfo.url).toBe(dfoPageUrl(r.num)); });
  it('lists all eight DFO regions once, mapped or stub', () => {
    expect(BC_REGIONS.map((r) => r.num)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect(BC_REGIONS.filter(isMapped).map((r) => r.id).sort()).toEqual(REGIONS.map((r) => r.id).sort());
  });
});
