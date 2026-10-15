// Pulls recent DFO Pacific fishery notices and keeps the recreational-salmon ones that mention Region 2 or one of
// our waters -> public/data/notices.json. The subject names the water for single-river notices; a region-wide
// opening lists its waters in the body, so each kept notice's page is read too. Notices often precede edits to the
// Region 2 page, so the app surfaces them per water and in a banner. Runs in `prebuild` (never fails the build).
// Usage: node scripts/fetch-notices.mjs
import { mkdirSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const LIST = (year, offset) => `https://notices.dfo-mpo.gc.ca/fns-sap/index-eng.cfm?pg=search_results&ID=all&Year=${year}&Count=${offset}`;
const NOTICE = (docId) => `https://notices.dfo-mpo.gc.ca/fns-sap/index-eng.cfm?pg=view_notice&DOC_ID=${docId}&ID=all`;
const PAGE_SIZE = 25, PAGES = 6, KEEP_DAYS = 45;
const OUT = new URL('../public/data/notices.json', import.meta.url);
const INIT = () => ({ headers: { 'user-agent': 'salmon-waters/0.1 (notice check)' }, signal: AbortSignal.timeout(15000) });

/** Water id -> pattern the notice subject (or a body bullet's lead) must match. Keep in step with src/data/regs.ts names. */
export const WATER_PATTERNS = {
  chilliwack: /chilliwack|vedder|sumas/i, capilano: /capilano/i, coquitlam: /coquitlam/i,
  'alouette-upper': /\balouette/i, 'alouette-lower': /\balouette/i, 'north-alouette': /north alouette/i,
  ashlu: /ashlu/i, cheakamus: /cheakamus/i, mamquam: /mamquam/i, squamish: /squamish/i,
  chapman: /chapman creek/i, chehalis: /chehalis/i, deboville: /de ?boville/i,
  'fraser-upper': /fraser/i, 'fraser-tidal': /fraser/i, 'harrison-upper': /harrison/i, 'harrison-lower': /harrison/i,
  kanaka: /kanaka/i, khartoum: /khartoum/i, lois: /lois lake/i, lcr: /little campbell/i, 'lcr-mouth': /little campbell/i,
  nicomekl: /nicomekl/i, nicomen: /nicomen|dewdney/i, norrish: /norrish|suicide creek/i, serpentine: /serpentine/i, stave: /stave/i,
  'u-pitt': /pitt river/i, 'u-seymour': /seymour/i, 'u-lillooet': /lillooet/i, 'u-coquihalla': /coquihalla/i, 'u-salmon': /salmon river/i,
  'u-elaho': /elaho/i, 'u-lynn': /lynn creek/i, 'u-indian': /indian river/i, 'u-brunette': /brunette/i, 'u-silverhope': /silverhope/i,
  'u-lois': /lois river/i, 'u-powell': /powell river/i,
};
const REGION = /region 2|lower mainland|lower fraser/i;
const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
const matching = (test) => Object.entries(WATER_PATTERNS).filter(([, re]) => test(re)).map(([id]) => id);
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

/** Does this subject concern recreational salmon fishing in our area? Returns { region, waters } or null. */
export function classify(subject) {
  if (!/recreational/i.test(subject) || !/salmon/i.test(subject)) return null;
  const waters = matching((re) => re.test(subject));
  const region = REGION.test(subject);
  return region || waters.length ? { region, waters } : null;
}

/** Notice page -> its body text (DFO wraps it in <pre>, one line per paragraph or bullet); '' when not found. */
export function noticeBody(html) {
  const m = /<pre[^>]*>([\s\S]*?)<\/pre>/i.exec(html);
  return m ? text(m[1]).replace(/\r/g, '').trim() : '';
}

/** Waters a notice body lists as "- Stave River, downstream of ...". Only the lead of each bullet counts: the water comes
 * first, and what follows the first comma / from / upstream / downstream names boundary landmarks (the Fraser, the Pitt). */
export function watersInBody(body) {
  const leads = [...body.matchAll(/^\s*[-•*]\s*(.+)$/gm)].map((m) => m[1].split(/,|\bfrom\b|\bupstream\b|\bdownstream\b|\bbetween\b/i)[0]);
  return matching((re) => leads.some((l) => re.test(l)));
}

/** Display subject: drop the "FN1114-RECREATIONAL - Salmon - " / "Salmon: Chum - " prefix. */
export const shortSubject = (s) => s.replace(/^FN\d+\s*-\s*/i, '').replace(/^recreational\s*-\s*salmon\s*[:-]\s*/i, '');

/** Add the waters the notice body lists to the ones its subject names. Keeps the subject's on any failure. */
async function withBodyWaters(n, fetchImpl) {
  try {
    const r = await fetchImpl(n.url, INIT());
    if (!r.ok) return n;
    const extra = new Set(watersInBody(noticeBody(await r.text())));
    return { ...n, waters: Object.keys(WATER_PATTERNS).filter((id) => n.waters.includes(id) || extra.has(id)) };
  } catch { return n; }
}

export async function fetchRecent(fetchImpl = fetch) {
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
  const kept = all.filter((n) => n.date >= cutoff).map((n) => ({ ...n, cls: classify(n.subject) })).filter((n) => n.cls)
    .map(({ cls, ...n }) => ({ ...n, subject: shortSubject(n.subject), region: cls.region, waters: cls.waters }))
    .sort((a, b) => b.sent.localeCompare(a.sent));
  const out = [];
  for (const n of kept) out.push(await withBodyWaters(n, fetchImpl));
  return out;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const status = { fetchedAt: new Date().toISOString(), ok: false, error: null, notices: [] };
  try { status.notices = await fetchRecent(); status.ok = true; } catch (e) { status.error = String(e?.message || e); }
  mkdirSync(new URL('../public/data/', import.meta.url), { recursive: true });
  writeFileSync(OUT, JSON.stringify(status, null, 2));
  console.log(`notices: ${status.ok ? `${status.notices.length} relevant` : `FAILED ${status.error}`}`);
  for (const n of status.notices.slice(0, 5)) console.log(`  ${n.date} ${n.fn} [${n.waters.join(',') || (n.region ? 'region' : '')}] ${n.subject.slice(0, 90)}`);
}
