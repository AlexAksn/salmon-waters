import { describe, expect, it } from 'vitest';
import { WATERS } from '../regions/r1/regs';
import { statusOf, type SpeciesPick, type Status } from './rules';

const BY_ID = new Map(WATERS.map((w) => [w.id, w]));
const W = (id: string) => BY_ID.get(id)!;
const D = (m: number, d: number) => new Date(2026, m - 1, d);
const cases: [string, Date, SpeciesPick, Status][] = [
  ['cowichan-upper', D(10, 1), 'any', 'cr'], ['cowichan-upper', D(11, 15), 'coho', 'open'], ['cowichan-upper', D(11, 15), 'any', 'open'], ['cowichan-upper', D(8, 1), 'any', 'none'],
  ['cowichan-lower', D(10, 1), 'coho', 'closed'], ['cowichan-lower', D(11, 20), 'coho', 'open'],
  ['koksilah', D(8, 1), 'coho', 'closed'], ['koksilah', D(10, 15), 'coho', 'open'], ['koksilah', D(6, 15), 'coho', 'open'], ['koksilah', D(1, 15), 'any', 'closed'],
  ['chemainus', D(2, 1), 'coho', 'open'], ['chemainus', D(6, 1), 'coho', 'none'],
  ['sproat', D(9, 1), 'any', 'cr'], ['sproat-upper', D(9, 1), 'any', 'closed'], ['sproat-upper', D(12, 1), 'chinook', 'cr'],
  ['nanaimo-lower', D(9, 15), 'any', 'cr'], ['nanaimo-lower', D(10, 20), 'coho', 'open'], ['nanaimo-lower', D(11, 5), 'chum', 'open'], ['nanaimo-lower', D(10, 20), 'chum', 'none'],
  ['nanaimo-upper', D(10, 20), 'coho', 'cr'], ['nanaimo-upper', D(10, 1), 'coho', 'cr'], ['nanaimo-canyon', D(7, 1), 'any', 'closed'],
  ['nitinat', D(10, 5), 'any', 'none'], ['nitinat', D(10, 20), 'coho', 'open'], ['nitinat', D(9, 1), 'chum', 'cr'], ['nitinat', D(9, 1), 'any', 'open'],
  ['somass-park', D(6, 1), 'sockeye', 'open'], ['somass', D(6, 1), 'sockeye', 'none'], ['somass-papermill', D(9, 1), 'any', 'closed'], ['somass', D(9, 1), 'chinook', 'open'],
  ['quatse', D(4, 1), 'coho', 'none'], ['quatse', D(7, 1), 'coho', 'open'], ['campbell-mouth', D(9, 1), 'coho', 'closed'], ['campbell', D(9, 1), 'coho', 'open'],
  ['stamp-upper', D(3, 1), 'any', 'closed'], ['stamp-lower', D(10, 10), 'coho', 'open'], ['comox-lake', D(5, 1), 'any', 'none'], ['comox-lake', D(8, 1), 'any', 'closed'],
  ['u-englishman', D(10, 1), 'any', 'none'],
];
describe('region 1 statusOf', () => {
  it.each(cases)('%s on %s for %s → %s', (id, d, sp, exp) => { expect(statusOf(W(id), d, sp)).toBe(exp); });
});
