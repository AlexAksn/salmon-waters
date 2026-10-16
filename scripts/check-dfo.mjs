// Fetches each region's DFO page and compares a hash of its regulations table with src/regions/<id>/region.json, so
// the app can warn when the transcribed rules may be stale. Runs on `npm run build` (prebuild). Never fails the build.
// Usage: node scripts/check-dfo.mjs            -> writes public/data/<id>/dfo-status.json per region
//        node scripts/check-dfo.mjs --hash <f> -> prints {pageModified, tableHash} for a saved HTML file
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dataDir, regions } from './regions.mjs';

function tableHash(html) {
  const tables = [...html.matchAll(/<table[\s\S]*?<\/table>/gi)].map((m) => m[0]).join('\n');
  const text = tables.replace(/<[^>]+>/g, ' ').replace(/&nbsp;|&#160;/g, ' ').replace(/\s+/g, ' ').trim();
  return createHash('sha256').update(text).digest('hex').slice(0, 16);
}
const pageModified = (html) => /dateModified"?>?\s*(\d{4}-\d{2}-\d{2})/.exec(html)?.[1] ?? null;
const args = process.argv.slice(2);
if (args[0] === '--hash') { const h = readFileSync(args[1], 'utf8'); console.log(JSON.stringify({ pageModified: pageModified(h), tableHash: tableHash(h) })); process.exit(0); }
for (const r of regions()) {
  const status = { checkedAt: new Date().toISOString(), ok: false, pageModified: null, tableHash: null, stale: false, error: null };
  try {
    const res = await fetch(r.dfo.url, { headers: { 'user-agent': 'salmon-waters/0.1 (freshness check)' }, signal: AbortSignal.timeout(15000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const html = await res.text();
    const hash = tableHash(html);
    Object.assign(status, { ok: true, pageModified: pageModified(html), tableHash: hash, stale: hash !== r.dfo.tableHash });
  } catch (e) { status.error = String(e?.message || e); }
  mkdirSync(dataDir(r.id), { recursive: true });
  writeFileSync(new URL('dfo-status.json', dataDir(r.id)), JSON.stringify(status, null, 2));
  console.log(`dfo-status ${r.id}:`, status);
}
