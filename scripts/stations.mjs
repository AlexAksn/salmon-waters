// Per region: ECCC station coordinates (-> the bbox one realtime request covers) and HYDAT long-term monthly mean
// discharge (-> "typical for this month" in the detail view) for every station in src/regions/<id>/gauges.ts.
// Rerun yearly, or after editing gauges.ts:  node scripts/stations.mjs r1 r2  ->  src/regions/<id>/stations.json
import { readFile, writeFile } from 'node:fs/promises';

const API = 'https://api.weather.gc.ca/collections';
const PAD = 0.02; // degrees around the outermost stations
const YEARS = 30; // most recent years with data that make up a monthly mean

async function getJson(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${r.status} ${url}`);
  return r.json();
}
export const stationIds = (gaugesTs) => [...new Set([...gaugesTs.matchAll(/stn: '([0-9A-Z]+)'/g)].map((m) => m[1]))].sort();

/** Monthly means over the most recent YEARS years with data, index 0 = January; null where HYDAT has none. */
export function monthlyMeans(features) {
  const typ = [], years = [];
  for (let m = 1; m <= 12; m++) {
    const mm = `-${String(m).padStart(2, '0')}`;
    const vals = features.filter((f) => f.properties.DATE.endsWith(mm) && f.properties.MONTHLY_MEAN_DISCHARGE != null)
      .sort((a, b) => b.properties.DATE.localeCompare(a.properties.DATE)).slice(0, YEARS).map((f) => f.properties.MONTHLY_MEAN_DISCHARGE);
    typ.push(vals.length ? +(vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(2) : null);
    years.push(vals.length);
  }
  return { typ, years };
}
export const bboxOf = (pts) => [
  +(Math.min(...pts.map((p) => p.lon)) - PAD).toFixed(3), +(Math.min(...pts.map((p) => p.lat)) - PAD).toFixed(3),
  +(Math.max(...pts.map((p) => p.lon)) + PAD).toFixed(3), +(Math.max(...pts.map((p) => p.lat)) + PAD).toFixed(3),
];

async function station(stn) {
  const meta = await getJson(`${API}/hydrometric-stations/items?STATION_NUMBER=${stn}&f=json`);
  const f = meta.features[0];
  if (!f) throw new Error(`${stn}: not in hydrometric-stations`);
  const [lon, lat] = f.geometry.coordinates;
  const mm = await getJson(`${API}/hydrometric-monthly-mean/items?STATION_NUMBER=${stn}&limit=3000&properties=DATE,MONTHLY_MEAN_DISCHARGE&f=json`);
  return { lon: +lon.toFixed(4), lat: +lat.toFixed(4), ...monthlyMeans(mm.features) };
}

async function region(id) {
  const ids = stationIds(await readFile(`src/regions/${id}/gauges.ts`, 'utf8'));
  const stations = {};
  const queue = [...ids];
  await Promise.all(Array.from({ length: 4 }, async () => { for (let s = queue.shift(); s; s = queue.shift()) stations[s] = await station(s); }));
  const sorted = Object.fromEntries(ids.map((s) => [s, stations[s]]));
  const out = { fetched: new Date().toISOString().slice(0, 10), bbox: bboxOf(Object.values(sorted)), stations: sorted };
  await writeFile(`src/regions/${id}/stations.json`, JSON.stringify(out, null, 1).replace(/\[\n\s+([^[\]]+?)\n\s+\]/gs, (_, b) => `[${b.replace(/,\n\s+/g, ', ')}]`) + '\n');
  console.log(`${id}: ${ids.length} stations, bbox ${out.bbox.join(',')}`);
}

if (process.argv[1]?.endsWith('stations.mjs')) {
  for (const id of process.argv.slice(2)) await region(id);
}
