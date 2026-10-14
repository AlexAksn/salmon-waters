import { describe, expect, it } from 'vitest';
import { trend, vsTypical, type Reading } from './flow';

const series = (vals: number[], stepH = 1): Reading[] => vals.map((q, i) => ({ t: i * stepH * 3600_000, q, level: null }));
describe('trend', () => {
  it('flags rising when the last 6 h gained > 5 %', () => { expect(trend(series([10, 10, 10, 10, 10, 10, 10, 11, 12, 13]))?.dir).toBe('rising'); });
  it('flags falling', () => { expect(trend(series([20, 19, 18, 17, 16, 15, 14, 13, 12, 11]))?.dir).toBe('falling'); });
  it('steady within ±5 %', () => { expect(trend(series([10, 10.1, 10, 10.2, 10.1, 10, 10.3, 10.2, 10.1, 10.2]))?.dir).toBe('steady'); });
  it('returns null without readings', () => { expect(trend([])).toBeNull(); });
});
describe('vsTypical', () => {
  it('classifies against the monthly mean', () => {
    expect(vsTypical(10, { month: 10, meanQ: 40, years: 30 })?.cls).toBe('low');
    expect(vsTypical(45, { month: 10, meanQ: 40, years: 30 })?.cls).toBe('normal');
    expect(vsTypical(90, { month: 10, meanQ: 40, years: 30 })?.cls).toBe('high');
    expect(vsTypical(10, { month: 10, meanQ: null, years: 0 })).toBeNull();
  });
});
