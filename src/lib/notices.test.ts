import { describe, expect, it } from 'vitest';
import { addDays, isoLocal } from './rules';
import { freshNotice, type Notice } from './notices';

describe('freshNotice', () => {
  const today = isoLocal(new Date());
  const n = (fn: string, daysAgo: number, waters: string[], region = false): Notice => ({ fn, docId: fn, subject: fn, date: isoLocal(addDays(new Date(), -daysAgo)), sent: '', url: '', region, waters });
  const listed = (id: string) => id !== 'u-x';
  it('shows a notice only while it is newer than the transcribed page', () => {
    const ns = [n('FN2', 2, ['a'])];
    expect(freshNotice(ns, isoLocal(addDays(new Date(), -5)), listed)?.fn).toBe('FN2');
    expect(freshNotice(ns, isoLocal(addDays(new Date(), -2)), listed)).toBeNull(); // page dated the notice day: already in the table
    expect(freshNotice(ns, today, listed)).toBeNull();
  });
  it('skips old, unlisted-only and non-region notices, picks the newest', () => {
    const old = '2000-01-01';
    expect(freshNotice([n('FN1', 20, ['a'])], old, listed)).toBeNull();
    expect(freshNotice([n('FN1', 1, ['u-x'])], old, listed)).toBeNull();
    expect(freshNotice([n('FN1', 1, [], true)], old, listed)?.fn).toBe('FN1');
    expect(freshNotice([n('FN3', 1, ['a']), n('FN2', 3, ['a'])], old, listed)?.fn).toBe('FN3');
  });
});
