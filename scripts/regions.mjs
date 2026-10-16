// Region descriptors for the build scripts: every src/regions/<id>/region.json (the app imports the same files).
import { readdirSync, readFileSync } from 'node:fs';

const ROOT = new URL('../src/regions/', import.meta.url);
export function regions() {
  return readdirSync(ROOT, { withFileTypes: true }).filter((d) => d.isDirectory()).flatMap((d) => {
    try { return [JSON.parse(readFileSync(new URL(`${d.name}/region.json`, ROOT), 'utf8'))]; } catch { return []; }
  }).sort((a, b) => a.num - b.num);
}
/** Where a region's generated files go (served at data/<id>/...). */
export const dataDir = (id) => new URL(`../public/data/${id}/`, import.meta.url);
/** region.json notice patterns -> { region: RegExp, waters: { id: RegExp } }. */
export const noticePatterns = (r) => ({
  region: new RegExp(r.notices.region, 'i'),
  waters: Object.fromEntries(Object.entries(r.notices.waters).map(([id, src]) => [id, new RegExp(src, 'i')])),
});
