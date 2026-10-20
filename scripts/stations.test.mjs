import { describe, expect, it } from 'vitest';
import { bboxOf, monthlyMeans, stationIds } from './stations.mjs';

const mm = (date, v) => ({ properties: { DATE: date, MONTHLY_MEAN_DISCHARGE: v } });
describe('stations script', () => {
  it('lists unique station numbers from gauges.ts', () => {
    expect(stationIds("a: { stn: '08MH001', name: 'x' },\n b: { stn: '08MH001' }, c: { stn: '08GA031' }")).toEqual(['08GA031', '08MH001']);
  });
  it('averages the most recent 30 years with data per month', () => {
    const feats = [];
    for (let y = 1960; y <= 2025; y++) feats.push(mm(`${y}-10`, y - 1900)); // 66 Octobers: 60..125
    feats.push(mm('2024-01', null), mm('2023-01', 5));
    const { typ, years } = monthlyMeans(feats);
    expect(typ[9]).toBe((96 + 125) / 2); // mean of 96..125
    expect(years[9]).toBe(30);
    expect(typ[0]).toBe(5); expect(years[0]).toBe(1);
    expect(typ[1]).toBeNull(); expect(years[1]).toBe(0);
  });
  it('pads the bbox around the outermost stations', () => {
    expect(bboxOf([{ lon: -123, lat: 49 }, { lon: -121.5, lat: 50.1 }])).toEqual([-123.02, 48.98, -121.48, 50.12]);
  });
});
