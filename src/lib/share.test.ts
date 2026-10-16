import { describe, expect, it } from 'vitest';
import { WATERS } from '../regions/r2/regs';
import region from '../regions/r2/region.json';
import { toMeta, type RegionJson } from '../regions/model';
import { statusOf } from './rules';
import { cardLines, shareText, shareTitle, type ShareInput } from './share';

const W = (id: string) => WATERS.find((w) => w.id === id)!;
const meta = toMeta(region as RegionJson);
const input = (id: string, date: Date, sp: ShareInput['sp'] = 'any'): ShareInput => ({ w: W(id), date, sp, status: statusOf(W(id), date, sp), region: meta, url: 'https://example.test/?r=r2&w=' + id });

describe('share card text', () => {
  it('lists one line per species with a rule today', () => {
    const lines = cardLines(W('chilliwack'), new Date(2026, 9, 14), 'any');
    expect(lines.some((l) => l.startsWith('Chinook:'))).toBe(true);
    expect(lines.every((l) => /^(Chinook|Coho|Chum|Pink|Sockeye|Gear|All salmon):/.test(l))).toBe(true);
  });
  it('says closed once for a closed water', () => {
    expect(cardLines(W('fraser-upper'), new Date(2026, 0, 1), 'any')).toHaveLength(1);
  });
  it('says so when nothing is listed', () => {
    expect(cardLines(W('kanaka'), new Date(2026, 9, 14), 'any')).toEqual(['No salmon opportunity listed today']);
    expect(cardLines(W('kanaka'), new Date(2026, 9, 14), 'coho')).toEqual(['Coho: closed']);
  });
  it('title and text carry name, status, date and link', () => {
    const s = input('chilliwack', new Date(2026, 9, 14));
    expect(shareTitle(s)).toBe('Chilliwack / Vedder River · Open · Oct 14');
    const t = shareText(s).split('\n');
    expect(t[0]).toBe(shareTitle(s));
    expect(t.at(-1)).toBe(s.url);
    expect(t.at(-2)).toMatch(/Not official/);
  });
});
