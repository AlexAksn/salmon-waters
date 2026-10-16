import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('bc-regions.json', () => {
  it('ships a closed outline for every DFO region', () => {
    const o = JSON.parse(readFileSync(new URL('../public/data/bc-regions.json', import.meta.url), 'utf8'));
    expect(o.regions.map((r) => r.num)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    for (const r of o.regions) for (const ring of r.rings) { expect(ring.length).toBeGreaterThan(3); expect(ring[0]).toEqual(ring[ring.length - 1]); }
  });
});
