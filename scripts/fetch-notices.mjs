// Pulls recent DFO Pacific fishery notices and, per region, keeps the recreational-salmon ones that mention the
// region or one of its waters -> public/data/<id>/notices.json. The subject names the water for single-river
// notices; a region-wide opening lists its waters in the body, so each kept notice's page is read too (once, shared
// by all regions). Notices often precede edits to the regulations page, so the app surfaces them per water and in a
// banner. Patterns live in src/regions/<id>/region.json. Runs in `prebuild` (never fails the build).
// Usage: node scripts/fetch-notices.mjs
import { mkdirSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { dataDir, noticePatterns, regions } from './regions.mjs';

const LIST = (year, offset) => `https://notices.dfo-mpo.gc.ca/fns-sap/index-eng.cfm?pg=search_results&ID=all&Year=${year}&Count=${offset}`;
const NOTICE = (docId) => `https://notices.dfo-mpo.gc.ca/fns-sap/index-eng.cfm?pg=view_notice&DOC_ID=${docId}&ID=all`;
const PAGE_SIZE = 25, PAGES = 6, KEEP_DAYS = 45;
const INIT = () => ({ headers: { 'user-agent': 'salmon-waters/0.1 (notice check)' }, signal: AbortSignal.timeout(15000) });
const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
const text = (html) => html.replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/&#39;|&rsquo;/g, '’').replace(/&quot;/g, '"').replace(/&nbsp;/g, ' ');

/** "October 13, 2026 at 8:39 AM" (Pacific time) -> { date: '2026-10-13', sent: '2026-10-13 08:39' } */
export function parseSent(text) {
  const m = /([A-Za-z]+)\s+(\d{1,2}),\s+(\d{4})(?:\s+at\s+(\d{1,2}):(\d{2})\s*(AM|PM))?/i.exec(text);
  if (!m) return null;
  const mon = MONTHS.indexOf(m[1].toLowerCase()); if (mon < 0) return null;
  const p = (n) => String(n).padStart(2, '0');
  const date = `${m[3]}-${p(mon + 1)}-${p(m[2])}`;
  let h = m[4] ? +m[4] % 12 : 0; if (m[6]?.toUpperCase() === 'PM') h += 12;
  return { date, sent: m[4] ? `${date} ${p(h)}:${m[5]}` : date };
}

/** One results page -> [{ fn, docId, subject, date, sent, url }] */
export function parseNotices(html) {
  const out = [];
  for (const row of html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)) {
    const m = /DOC_ID=(\d+)[^>]*>\s*(FN\d+)\s*</.exec(row[1]); if (!m) continue;
    const cells = [...row[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map((c) => text(c[1]).replace(/\s+/g, ' ').trim());
    const when = parseSent(cells[2] || ''); if (!when) continue;
    out.push({ fn: m[2], docId: m[1], subject: cells[1] || '', ...when, url: NOTICE(m[1]) });
  }
  return out;
}

/** Does this subject concern recreational salmon fishing in region P (see regions.mjs noticePatterns)? -> { region, waters } | null */
export function classify(subject, P) {
  if (!/recreational/i.test(subject) || !/salmon/i.test(subject)) return null;
  const waters = Object.keys(P.waters).filter((id) => P.waters[id].test(subject));
  const region = P.region.test(subject);
  return region || waters.length ? { region, waters } : null;
}

/** Notice page -> its body text (DFO wraps it in <pre>, one line per paragraph or bullet); '' when not found. */
export function noticeBody(html) {
  const m = /<pre[^>]*>([\s\S]*?)<\/pre>/i.exec(html);
  return m ? text(m[1]).replace(/\r/g, '').trim() : '';
}

/** Waters a notice body lists as "- Stave River, downstream of ...". Only the lead of each bullet counts: the water comes
 * first, and what follows the first comma / from / upstream / downstream names boundary landmarks (the Fraser, the Pitt). */
export function watersInBody(body, patterns) {
  const leads = [...body.matchAll(/^\s*[-•*]\s*(.+)$/gm)].map((m) => m[1].split(/,|\bfrom\b|\bupstream\b|\bdownstream\b|\bbetween\b/i)[0]);
  return Object.keys(patterns).filter((id) => leads.some((l) => patterns[id].test(l)));
}

/** Display subject: drop the "FN1114-RECREATIONAL - Salmon - " / "Salmon: Chum - " prefix. */
export const shortSubject = (s) => s.replace(/^FN\d+\s*-\s*/i, '').replace(/^recreational\s*-\s*salmon\s*[:-]\s*/i, '');

/** Every notice from the last KEEP_DAYS days, newest first. One listing serves all regions. */
export async function fetchListing(fetchImpl = fetch) {
  const now = new Date(), years = [now.getFullYear()];
  if (now.getMonth() === 0) years.push(now.getFullYear() - 1); // January: last year's notices are still recent
  const seen = new Set(), all = [];
  for (const year of years) {
    for (let page = 0; page < PAGES; page++) {
      const r = await fetchImpl(LIST(year, page * PAGE_SIZE + 1), INIT());
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const rows = parseNotices(await r.text());
      if (!rows.length) break;
      for (const n of rows) if (!seen.has(n.fn)) { seen.add(n.fn); all.push(n); }
    }
  }
  const cutoff = new Date(now.getTime() - KEEP_DAYS * 864e5).toISOString().slice(0, 10);
  return all.filter((n) => n.date >= cutoff).sort((a, b) => b.sent.localeCompare(a.sent));
}

/** notice -> body text, each page fetched at most once; '' when it can't be read (the subject's waters still count). */
export function bodyFetcher(fetchImpl = fetch) {
  const cache = new Map();
  return (n) => {
    let p = cache.get(n.docId);
    if (!p) { p = fetchImpl(n.url, INIT()).then((r) => (r.ok ? r.text() : '')).then(noticeBody).catch(() => ''); cache.set(n.docId, p); }
    return p;
  };
}

/** The listing's notices that concern region P, each with the waters its subject names plus the ones its body lists. */
export async function relevant(rows, P, bodyOf) {
  const kept = rows.map((n) => ({ ...n, cls: classify(n.subject, P) })).filter((n) => n.cls)
    .map(({ cls, ...n }) => ({ ...n, subject: shortSubject(n.subject), region: cls.region, waters: cls.waters }));
  const out = [];
  for (const n of kept) {
    const extra = new Set(watersInBody(await bodyOf(n), P.waters));
    out.push({ ...n, waters: Object.keys(P.waters).filter((id) => n.waters.includes(id) || extra.has(id)) });
  }
  return out;
}
export const fetchRecent = async (P, fetchImpl = fetch) => relevant(await fetchListing(fetchImpl), P, bodyFetcher(fetchImpl));

/** Pinned "we moved" entry for browsers still running the cached build from alexaksn.github.io: their service worker can
 * never update (its script URL now redirects), but they still fetch this file through GitHub's redirect. Dated today so
 * the old app's "New notice" banner and notice list show it; the current app drops it (src/lib/notices.ts realNotices). */
export const todayPacific = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Vancouver' });
export const movedNotice = (date = todayPacific()) => ({
  fn: 'salmonwaters.ca', docId: 'moved', date, sent: `${date} 23:59`, url: 'https://salmonwaters.ca/', region: true, waters: [], moved: true,
  subject: 'Salmon Waters has moved here; this old address no longer updates.',
});

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const fetchedAt = new Date().toISOString();
  let rows = null, listError = null;
  try { rows = await fetchListing(); } catch (e) { listError = String(e?.message || e); }
  const bodyOf = bodyFetcher();
  for (const r of regions()) {
    const status = { fetchedAt, ok: false, error: listError, notices: [] };
    if (rows) { try { status.notices = [movedNotice(), ...await relevant(rows, noticePatterns(r), bodyOf)]; status.ok = true; } catch (e) { status.error = String(e?.message || e); } }
    mkdirSync(dataDir(r.id), { recursive: true });
    writeFileSync(new URL('notices.json', dataDir(r.id)), JSON.stringify(status, null, 2));
    console.log(`notices ${r.id}: ${status.ok ? `${status.notices.length} relevant` : `FAILED ${status.error}`}`);
    for (const n of status.notices.slice(0, 5)) console.log(`  ${n.date} ${n.fn} [${n.waters.join(',') || (n.region ? 'region' : '')}] ${n.subject.slice(0, 90)}`);
  }
}
