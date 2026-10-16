import { describe, expect, it } from 'vitest';
import { DEFAULT_REGION, REGIONS, regionEntry } from './index';
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
  it('has a default', () => { expect(regionEntry(DEFAULT_REGION)).toBeTruthy(); expect(regionEntry('nope')).toBeUndefined(); });
});
