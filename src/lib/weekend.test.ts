import { describe, expect, it } from 'vitest';
import { WATERS } from '../regions/r2/regs';
import { changeText, fmtRange, groupEvents, weekendOf, weekendSummary } from './weekend';

const D = (m: number, d: number) => new Date(2026, m - 1, d);
describe('weekend', () => {
  it('finds the coming Saturday and Sunday', () => {
    expect(weekendOf(D(10, 15)).sat.getDate()).toBe(17); // Thu -> Sat 17
    expect(weekendOf(D(10, 17)).sat.getDate()).toBe(17); // Sat stays
    expect(weekendOf(D(10, 18)).sat.getDate()).toBe(17); // Sun -> yesterday's Sat
    expect(weekendOf(D(10, 19)).sat.getDate()).toBe(24); // Mon -> next Sat
  });
  it('formats ranges across months', () => {
    expect(fmtRange(D(10, 17), D(10, 18))).toBe('Oct 17–18');
    expect(fmtRange(D(10, 31), D(11, 1))).toBe('Oct 31–Nov 1');
  });
  it('lists changes between the date and Sunday, counts for Saturday', () => {
    const s = weekendSummary(WATERS, D(10, 15));
    expect(s.events.every((e) => e.d > D(10, 15) && e.d <= D(10, 18))).toBe(true);
    expect(s.events.some((e) => e.d.getDate() === 17 && e.ch.some((c) => c.kind === 'sp' && c.sp === 'chum' && c.to === 'open'))).toBe(true); // FN1122 chum opening
    expect(s.counts.open + s.counts.cr + s.counts.closed).toBeGreaterThan(0);
    expect(weekendSummary(WATERS, D(10, 18)).events).toEqual([]); // Sunday: nothing left to change
  });
  it('groups same-day identical changes and words them', () => {
    const s = weekendSummary(WATERS, D(10, 15));
    const g = groupEvents(s.events);
    expect(g.length).toBeLessThan(s.events.length);
    const chum = g.find((x) => x.text.startsWith('Chum opens'))!;
    expect(chum.names.length).toBeGreaterThan(3);
    expect(new Set(chum.names).size).toBe(chum.names.length);
    expect(changeText({ kind: 'sp', sp: 'coho', from: 'open', to: 'closed', limit: 'x' })).toBe('Coho closes');
    expect(changeText({ kind: 'gear', from: '', to: 'Bait ban' })).toBe('Bait ban starts');
  });
});
