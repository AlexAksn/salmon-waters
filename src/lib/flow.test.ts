import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchArea, parseCsv, trend, typical, vsTypical, type Reading } from './flow';

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

describe('parseCsv', () => {
  it('maps the API columns and reads empty cells as null', () => {
    const rows = parseCsv('x,y,STATION_NUMBER,DATETIME,LEVEL,DISCHARGE\n-122.7,49.3,08MH149,2026-10-19T19:05:00Z,45.074,\n-122.9,49.4,08GA079,2026-10-19T19:05:00Z,,0.932\n');
    expect(rows).toEqual([
      { stn: '08MH149', t: Date.parse('2026-10-19T19:05:00Z'), level: 45.074, q: null },
      { stn: '08GA079', t: Date.parse('2026-10-19T19:05:00Z'), level: null, q: 0.932 },
    ]);
  });
});
describe('fetchArea', () => {
  afterEach(() => vi.unstubAllGlobals());
  const csv = (rows: string[]) => ['x,y,STATION_NUMBER,DATETIME,LEVEL,DISCHARGE', ...rows].join('\n');
  const row = (stn: string, i: number, level = '1') => `-123,49,${stn},${new Date(Date.UTC(2026, 9, 19, 0, i)).toISOString()},${level},`;
  it('pages at 10 000 rows, groups by station, sorts by time, drops empty readings', async () => {
    const calls: string[] = [];
    vi.stubGlobal('fetch', async (u: string) => {
      calls.push(u);
      const offset = Number(new URL(u).searchParams.get('offset'));
      // page 1: 10 000 rows for A/B out of order; page 2: 2 rows for C and one with no values
      const body = offset === 0 ? csv(Array.from({ length: 10_000 }, (_, i) => row(i % 2 ? 'A' : 'B', 9_999 - i))) : csv([row('C', 1), row('C', 2, '')]);
      return new Response(body, { status: 200 });
    });
    const r = await fetchArea([-1, -1, 1, 1], 24);
    expect(calls).toHaveLength(2);
    expect(new URL(calls[0]).searchParams.get('bbox')).toBe('-1,-1,1,1');
    expect(new URL(calls[1]).searchParams.get('offset')).toBe('10000');
    expect(Object.keys(r).sort()).toEqual(['A', 'B', 'C']);
    expect(r.A).toHaveLength(5000);
    expect(r.A.every((x, i) => i === 0 || x.t > r.A[i - 1].t)).toBe(true);
    expect(r.C).toHaveLength(1);
  });
  it('stops after one short page', async () => {
    let n = 0;
    vi.stubGlobal('fetch', async () => { n++; return new Response(csv([row('A', 1)]), { status: 200 }); });
    expect(Object.keys(await fetchArea([-2, -2, 2, 2], 24))).toEqual(['A']);
    expect(n).toBe(1);
  });
  it('rejects on an API error', async () => {
    vi.stubGlobal('fetch', async () => new Response('', { status: 503 }));
    await expect(fetchArea([-3, -3, 3, 3], 24)).rejects.toThrow('hydrometric 503');
  });
});
describe('typical', () => {
  const s = { lon: 0, lat: 0, typ: [10, null, 30, 40, 50, 60, 70, 80, 90, 100, 110, 120], years: [30, 0, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30] };
  it('reads the month from stations.json', () => { expect(typical(s, 10)).toEqual({ month: 10, meanQ: 100, years: 30 }); });
  it('is null without a station or a mean', () => { expect(typical(undefined, 10)).toBeNull(); expect(typical(s, 2)).toBeNull(); });
});
