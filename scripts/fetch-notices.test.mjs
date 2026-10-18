import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { classify, noticeBody, parseNotices, parseSent, relevant, shortSubject, watersInBody } from './fetch-notices.mjs';
import { noticePatterns } from './regions.mjs';

const html = readFileSync(new URL('./fixtures/notices-2026-10-13.html', import.meta.url), 'utf8');
const fn1122 = readFileSync(new URL('./fixtures/notice-FN1122.html', import.meta.url), 'utf8');
const P = noticePatterns(JSON.parse(readFileSync(new URL('../src/regions/r2/region.json', import.meta.url), 'utf8')));
describe('fetch-notices', () => {
  it('parses the results table', () => {
    const rows = parseNotices(html);
    expect(rows.length).toBe(26);
    expect(rows[0]).toMatchObject({ fn: 'FN1118', docId: '370585', date: '2026-10-13', sent: '2026-10-13 15:23' });
    expect(rows[0].url).toContain('DOC_ID=370585');
  });
  it('keeps only recreational salmon notices for our area', () => {
    const kept = parseNotices(html).map((n) => ({ ...n, cls: classify(n.subject, P) })).filter((n) => n.cls);
    expect(kept.map((n) => n.fn)).toEqual(['FN1114']);
    expect(kept[0].cls).toEqual({ region: true, waters: ['capilano'] });
    expect(shortSubject(kept[0].subject)).toMatch(/^Region 2 - Capilano River/);
  });
  it('classifies subjects', () => {
    expect(classify('FN0001-RECREATIONAL - Salmon - Chilliwack/Vedder River - Opening', P)?.waters).toEqual(['chilliwack']);
    expect(classify('FN0002-COMMERCIAL - Salmon - Region 2', P)).toBeNull();
    expect(classify('FN0003-RECREATIONAL - Groundfish - Region 2', P)).toBeNull();
    expect(classify('FN0004-RECREATIONAL - Salmon - Area 14 - Puntledge River', P)).toBeNull();
  });
  it('reads the waters a notice body lists, ignoring boundary landmarks', () => {
    const body = noticeBody(fn1122);
    expect(body).toMatch(/^Further to FN1119/);
    expect(body).toContain('the Fraser River'); // named as a landmark only: must not become a water below
    expect(watersInBody(body, P.waters)).toEqual(['chilliwack', 'alouette-upper', 'alouette-lower', 'chehalis', 'harrison-upper', 'harrison-lower', 'nicomen', 'nicomen-lower', 'serpentine', 'stave']);
    expect(watersInBody('Prose only. The Fraser River and the Stave River are mentioned.', P.waters)).toEqual([]);
    expect(noticeBody('<html>no body</html>')).toBe('');
  });
  it('merges subject and body waters per region', async () => {
    const rows = [{ fn: 'FN1122', docId: '370681', subject: 'FN1122-RECREATIONAL - Salmon: Chum - Region 2 Lower Mainland Tributary Systems - Opening', date: '2026-10-15', sent: '2026-10-15 15:37', url: 'x' },
      { fn: 'FN0002', docId: '2', subject: 'FN0002-RECREATIONAL - Salmon - Area 14 - Puntledge River', date: '2026-10-15', sent: '2026-10-15 09:00', url: 'y' }];
    const out = await relevant(rows, P, async (n) => (n.docId === '370681' ? noticeBody(fn1122) : ''));
    expect(out.map((n) => n.fn)).toEqual(['FN1122']);
    expect(out[0]).toMatchObject({ region: true, subject: 'Chum - Region 2 Lower Mainland Tributary Systems - Opening' });
    expect(out[0].waters).toContain('stave');
  });
  it('shortens subjects', () => {
    expect(shortSubject('FN1122-RECREATIONAL - Salmon: Chum - Region 2 Lower Mainland Tributary Systems - Opening - October 17, 2026')).toBe('Chum - Region 2 Lower Mainland Tributary Systems - Opening - October 17, 2026');
    expect(shortSubject('FN0001-RECREATIONAL - Salmon - Chilliwack/Vedder River - Opening')).toBe('Chilliwack/Vedder River - Opening');
  });
  it('parses sent timestamps', () => {
    expect(parseSent('October 13, 2026 at 8:39 AM')).toEqual({ date: '2026-10-13', sent: '2026-10-13 08:39' });
    expect(parseSent('January 2, 2026 at 12:05 PM')).toEqual({ date: '2026-01-02', sent: '2026-01-02 12:05' });
    expect(parseSent('nonsense')).toBeNull();
  });
});
