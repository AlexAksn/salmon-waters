// River conditions from ECCC's MSC GeoMet OGC API (CORS-enabled, 5-minute readings).
// https://api.weather.gc.ca/collections/hydrometric-realtime
import type { BBox, StationInfo } from '../regions/model';
export interface Reading { t: number; level: number | null; q: number | null }
export type TrendDir = 'rising' | 'falling' | 'steady';
export interface Trend { dir: TrendDir; pct6h: number | null; pct24h: number | null }
export interface Typical { month: number; meanQ: number | null; years: number }

const API = 'https://api.weather.gc.ca/collections';
/** Readings are refreshed this often (lib cache TTL and App poll share it). */
export const FLOW_TTL_MS = 10 * 60_000;
async function get(url: string, tag: string): Promise<Response> {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${tag} ${r.status}`);
  return r;
}
const getJson = <T,>(url: string, tag: string): Promise<T> => get(url, tag).then((r) => r.json() as Promise<T>);
const cache = new Map<string, { at: number; p: Promise<unknown> }>();
function cached<T>(key: string, ttlMs: number, fn: () => Promise<T>): Promise<T> {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < ttlMs) return hit.p as Promise<T>;
  const p = fn().catch((e) => { cache.delete(key); throw e; });
  cache.set(key, { at: Date.now(), p });
  return p;
}

const RT = `${API}/hydrometric-realtime/items`;
const since = (hours: number) => new Date(Date.now() - hours * 3600_000).toISOString().replace(/\.\d{3}Z$/, 'Z');
const has = (r: Reading) => r.level != null || r.q != null;
interface RtFeature { properties: { DATETIME: string; LEVEL: number | null; DISCHARGE: number | null } }
/** One station's readings, for the detail chart. */
export function fetchHistory(stn: string, hours: number): Promise<Reading[]> {
  return cached(`h:${stn}:${hours}`, FLOW_TTL_MS, async () => {
    const u = `${RT}?STATION_NUMBER=${stn}&datetime=${since(hours)}/..&sortby=DATETIME&limit=1000&properties=DATETIME,LEVEL,DISCHARGE&f=json`;
    const j = await getJson<{ features: RtFeature[] }>(u, 'hydrometric');
    return j.features.map((f) => ({ t: Date.parse(f.properties.DATETIME), level: f.properties.LEVEL, q: f.properties.DISCHARGE })).filter(has);
  });
}

/** The API pages at 10 000 rows; a region's 24 h is one or two pages. CSV is half the bytes of GeoJSON. */
const PAGE = 10_000, MAX_PAGES = 5;
/** Readings for every station inside `bbox` keyed by station number: one request per page instead of one per station. */
export function fetchArea(bbox: BBox, hours: number): Promise<Record<string, Reading[]>> {
  return cached(`a:${bbox.join(',')}:${hours}`, FLOW_TTL_MS, async () => {
    const base = `${RT}?bbox=${bbox.join(',')}&datetime=${since(hours)}/..&sortby=DATETIME&limit=${PAGE}&properties=STATION_NUMBER,DATETIME,LEVEL,DISCHARGE&f=csv`;
    const out: Record<string, Reading[]> = {};
    for (let page = 0; page < MAX_PAGES; page++) {
      const rows = parseCsv(await (await get(`${base}&offset=${page * PAGE}`, 'hydrometric')).text());
      for (const r of rows) if (has(r)) (out[r.stn] ??= []).push(r);
      if (rows.length < PAGE) break;
    }
    for (const rs of Object.values(out)) rs.sort((a, b) => a.t - b.t);
    return out;
  });
}
/** `x,y,STATION_NUMBER,DATETIME,LEVEL,DISCHARGE` with empty cells for missing values. */
export function parseCsv(text: string): (Reading & { stn: string })[] {
  const lines = text.trim().split('\n');
  const col = Object.fromEntries(lines[0].trim().split(',').map((h, i) => [h, i]));
  const num = (s: string | undefined) => (s === undefined || s === '' ? null : Number(s));
  return lines.slice(1).map((l) => { const c = l.split(','); return { stn: c[col.STATION_NUMBER], t: Date.parse(c[col.DATETIME]), level: num(c[col.LEVEL]), q: num(c[col.DISCHARGE]) }; });
}

/** "Typical for this month": HYDAT long-term mean from stations.json (scripts/stations.mjs). */
export const typical = (s: StationInfo | undefined, month: number): Typical | null =>
  s && s.typ[month - 1] != null ? { month, meanQ: s.typ[month - 1], years: s.years[month - 1] } : null;

export const metric = (r: Reading) => (r.q != null ? r.q : r.level);
/** Min/max of the plotted metric over a series (null when nothing is plottable). */
export function metricRange(rs: Reading[]): { min: number; max: number } | null {
  let min = Infinity, max = -Infinity;
  for (const r of rs) { const v = metric(r); if (v != null) { if (v < min) min = v; if (v > max) max = v; } }
  return min === Infinity ? null : { min, max };
}
export const TREND_ARROW: Record<TrendDir, string> = { rising: '▲', falling: '▼', steady: '▶' };
export const hasFlow = (rs: Reading[]) => rs.some((r) => r.q != null);
export function latest(rs: Reading[]): Reading | null { return rs.length ? rs[rs.length - 1] : null; }
function at(rs: Reading[], tMs: number): Reading | null {
  // last reading at or before tMs
  let best: Reading | null = null;
  for (const r of rs) { if (r.t <= tMs) best = r; else break; }
  return best;
}
export function trend(rs: Reading[]): Trend | null {
  const now = latest(rs); if (!now) return null;
  const v0 = metric(now); if (v0 == null) return null;
  const pct = (then: Reading | null) => { const v = then ? metric(then) : null; return v == null || v === 0 ? null : ((v0 - v) / v) * 100; };
  const pct6h = pct(at(rs, now.t - 6 * 3600_000)), pct24h = pct(at(rs, now.t - 24 * 3600_000));
  const ref = pct6h ?? pct24h;
  const dir: TrendDir = ref == null ? 'steady' : ref > 5 ? 'rising' : ref < -5 ? 'falling' : 'steady';
  return { dir, pct6h, pct24h };
}
export function fmtQ(q: number) { return q >= 100 ? q.toFixed(0) : q >= 10 ? q.toFixed(1) : q.toFixed(2); }
/** Value with unit: discharge in m³/s, otherwise level in m. */
export const fmtMetric = (v: number, isFlow: boolean) => (isFlow ? `${fmtQ(v)} m³/s` : `${v.toFixed(2)} m`);
export function fmtReading(r: Reading) { return r.q != null ? fmtMetric(r.q, true) : r.level != null ? fmtMetric(r.level, false) : '—'; }
export type Normal = 'low' | 'normal' | 'high';
export function vsTypical(q: number, typ: Typical): { ratio: number; cls: Normal } | null {
  if (typ.meanQ == null || typ.meanQ <= 0) return null;
  const ratio = q / typ.meanQ;
  return { ratio, cls: ratio < 0.6 ? 'low' : ratio > 1.6 ? 'high' : 'normal' };
}
export function ageMinutes(r: Reading) { return Math.round((Date.now() - r.t) / 60_000); }

export const wateroffice = (stn: string) => `https://wateroffice.ec.gc.ca/report/real_time_e.html?stn=${stn}`;
