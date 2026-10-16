import { describe, expect, it } from 'vitest';
import type { Water } from '../regions/model';
import { daySummary, ruleLine, seasonRuns, speciesPicksFor, statusOf, upcoming, waterFish } from './rules';

// A hypothetical chum opening added purely as data, the way DFO would publish it.
const vedder: Water = {
  id: 'test-vedder', name: 'Chilliwack / Vedder River', rules: [
    { sp: 'coho', kind: 'keep', from: '09-01', to: '12-31', limit: '4 hatchery marked per day' },
    { sp: 'chum', kind: 'keep', from: '10-20', to: '11-30', limit: '2 per day' },
  ],
};
const D = (m: number, d: number) => new Date(2026, m - 1, d);

describe('a new species is data, not code', () => {
  it('appears as a chip only once a rule names it', () => {
    expect(speciesPicksFor([vedder]).map((p) => p.id)).toEqual(['any', 'coho', 'chum']);
    expect(speciesPicksFor([{ ...vedder, rules: vedder.rules.slice(0, 1) }]).map((p) => p.id)).toEqual(['any', 'coho']);
  });
  it('is counted by status, summary and one-line rule', () => {
    expect(statusOf(vedder, D(10, 25), 'chum')).toBe('open');
    expect(statusOf(vedder, D(10, 15), 'chum')).toBe('none');
    expect(statusOf(vedder, D(10, 25), 'any')).toBe('open');
    expect(daySummary(vedder, D(10, 25)).fish.chum.keep).toHaveLength(1);
    expect(ruleLine(vedder, D(10, 25), 'any').parts.map((p) => `${p.sp}:${p.text}`)).toEqual(['coho:4 hatchery marked per day', 'chum:2 per day']);
  });
  it('gets its own season-strip row and a changing-soon entry', () => {
    expect(waterFish(vedder)).toEqual(['coho', 'chum']);
    const runs = seasonRuns(vedder, 'chum', 2026).filter((r) => r.st === 'open');
    expect(runs).toHaveLength(1); expect(runs[0].n).toBe(42); // Oct 20 – Nov 30
    const ev = upcoming(D(10, 14), 45, [vedder]);
    expect(ev.map((e) => `${e.d.getMonth() + 1}-${e.d.getDate()}:${e.ch.map((c) => c.kind === 'sp' ? `${c.sp}→${c.to}` : 'gear').join(',')}`)).toEqual(['10-20:chum→open']);
  });
});
