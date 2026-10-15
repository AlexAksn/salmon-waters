import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { classify, parseNotices, parseSent, shortSubject } from './fetch-notices.mjs';

const html = readFileSync(new URL('./fixtures/notices-2026-10-13.html', import.meta.url), 'utf8');
describe('fetch-notices', () => {
  it('parses the results table', () => {
    const rows = parseNotices(html);
    expect(rows.length).toBe(26);
    expect(rows[0]).toMatchObject({ fn: 'FN1118', docId: '370585', date: '2026-10-13', sent: '2026-10-13 15:23' });
    expect(rows[0].url).toContain('DOC_ID=370585');
  });
  it('keeps only recreational salmon notices for our area', () => {
    const kept = parseNotices(html).map((n) => ({ ...n, cls: classify(n.subject) })).filter((n) => n.cls);
    expect(kept.map((n) => n.fn)).toEqual(['FN1114']);
    expect(kept[0].cls).toEqual({ region: true, waters: ['capilano'] });
    expect(shortSubject(kept[0].subject)).toMatch(/^Region 2 - Capilano River/);
  });
  it('classifies subjects', () => {
    expect(classify('FN0001-RECREATIONAL - Salmon - Chilliwack/Vedder River - Opening')?.waters).toEqual(['chilliwack']);
    expect(classify('FN0002-COMMERCIAL - Salmon - Region 2')).toBeNull();
    expect(classify('FN0003-RECREATIONAL - Groundfish - Region 2')).toBeNull();
    expect(classify('FN0004-RECREATIONAL - Salmon - Area 14 - Puntledge River')).toBeNull();
  });
  it('parses sent timestamps', () => {
    expect(parseSent('October 13, 2026 at 8:39 AM')).toEqual({ date: '2026-10-13', sent: '2026-10-13 08:39' });
    expect(parseSent('January 2, 2026 at 12:05 PM')).toEqual({ date: '2026-01-02', sent: '2026-01-02 12:05' });
    expect(parseSent('nonsense')).toBeNull();
  });
});
