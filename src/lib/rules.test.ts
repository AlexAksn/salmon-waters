import { describe, expect, it } from 'vitest';
import { WATERS } from '../data/regs';
import { statusOf, upcoming, type SpeciesPick, type Status } from './rules';

const W = Object.fromEntries(WATERS.map((w) => [w.id, w]));
const D = (m: number, d: number) => new Date(2026, m - 1, d);
const cases: [string, Date, SpeciesPick, Status][] = [
  ['chilliwack', D(10, 14), 'any', 'open'], ['chilliwack', D(10, 14), 'chinook', 'open'], ['chilliwack', D(7, 15), 'coho', 'cr'], ['chilliwack', D(3, 1), 'any', 'none'],
  ['alouette-upper', D(9, 15), 'coho', 'cr'], ['alouette-upper', D(9, 15), 'any', 'open'], ['alouette-upper', D(10, 14), 'coho', 'open'],
  ['fraser-upper', D(1, 1), 'any', 'closed'], ['fraser-upper', D(10, 14), 'coho', 'closed'], ['kanaka', D(10, 14), 'any', 'none'], ['kanaka', D(11, 1), 'coho', 'open'],
  ['ashlu', D(1, 15), 'coho', 'open'], ['ashlu', D(2, 15), 'coho', 'none'], ['ashlu', D(12, 31), 'any', 'open'], ['lcr-mouth', D(9, 1), 'any', 'closed'], ['lcr-mouth', D(10, 1), 'coho', 'open'], ['lcr', D(9, 20), 'chinook', 'cr'],
  ['capilano', D(10, 14), 'chinook', 'open'], ['capilano', D(12, 15), 'chinook', 'none'], ['capilano', D(12, 15), 'coho', 'open'], ['khartoum', D(2, 2), 'any', 'open'], ['fraser-tidal', D(5, 5), 'any', 'tidal'],
];
describe('statusOf', () => {
  it.each(cases)('%s on %s for %s → %s', (id, d, sp, exp) => { expect(statusOf(W[id], d, sp)).toBe(exp); });
});
describe('upcoming', () => {
  it('finds Kanaka Creek opening Nov 1 from Oct 14', () => {
    const ev = upcoming(D(10, 14), 45, WATERS).filter((e) => e.w.id === 'kanaka');
    expect(ev.length).toBe(1);
    expect(ev[0].d.getMonth()).toBe(10); expect(ev[0].d.getDate()).toBe(1);
    expect(ev[0].ch[0]).toMatchObject({ sp: 'coho', from: 'none', to: 'open' });
  });
});
