// Fetches the DFO Region 2 page and records its "Date modified" + a hash of the regulations table,
// so the app can warn when the transcribed rules (src/data/regs.ts) may be stale.
// Runs on `npm run build` (prebuild). Never fails the build.  Usage: node scripts/check-dfo.mjs [--hash-only <file>]
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

const PAGE = 'https://www.pac.dfo-mpo.gc.ca/fm-gp/rec/fresh-douce/region2-eng.html';
const OUT = new URL('../public/data/dfo-status.json', import.meta.url);

export function tableHash(html) {
  const tables = [...html.matchAll(/<table[\s\S]*?<\/table>/gi)].map((m) => m[0]).join('\n');
  const text = tables.replace(/<[^>]+>/g, ' ').replace(/&nbsp;|&#160;/g, ' ').replace(/\s+/g, ' ').trim();
  return createHash('sha256').update(text).digest('hex').slice(0, 16);
}
export function pageModified(html) { return /dateModified"?>?\s*(\d{4}-\d{2}-\d{2})/.exec(html)?.[1] ?? null; }

const args = process.argv.slice(2);
if (args[0] === '--hash-only') { const h = readFileSync(args[1], 'utf8'); console.log(JSON.stringify({ pageModified: pageModified(h), tableHash: tableHash(h) })); process.exit(0); }

const status = { checkedAt: new Date().toISOString(), ok: false, pageModified: null, tableHash: null, error: null };
try {
  const r = await fetch(PAGE, { headers: { 'user-agent': 'salmon-waters/0.1 (freshness check)' }, signal: AbortSignal.timeout(20000) });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const html = await r.text();
  Object.assign(status, { ok: true, pageModified: pageModified(html), tableHash: tableHash(html) });
} catch (e) { status.error = String(e?.message || e); }
mkdirSync(new URL('../public/data/', import.meta.url), { recursive: true });
writeFileSync(OUT, JSON.stringify(status, null, 2));
console.log('dfo-status:', status);
