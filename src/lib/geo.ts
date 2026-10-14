import type { Water } from '../data/regs';

export type Coord = [lon: number, lat: number];
export interface BaseData {
  land: Coord[][][];
  lakes: { r: Coord[][]; n: string | null }[];
  rivers: { r: Coord[][]; n: string | null }[];
  hw: { c: Coord[]; p: [route: string, cls: 'f' | 'h'] }[];
  sec: { c: Coord[]; p: string }[];
  rail: { c: Coord[] }[];
}
export interface Mark { l: string; c: Coord; k: 'b' | 'i'; a: boolean }
export interface WatersGeo { geo: Record<string, Coord[][]>; marks: Mark[] }
export type LatLon = [lat: number, lon: number];

export function km(a: LatLon, b: LatLon) {
  const R = 6371, toR = Math.PI / 180;
  const dLat = (b[0] - a[0]) * toR, dLon = (b[1] - a[1]) * toR;
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(a[0] * toR) * Math.cos(b[0] * toR) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}

/** Representative point of a water: middle vertex of its first segment, or lake centroid. */
export function waterMid(w: Water, wg: WatersGeo, base: BaseData): LatLon | null {
  if (w.lake) {
    const lk = base.lakes.find((p) => p.n === w.lake);
    if (!lk) return null;
    const ring = lk.r[0];
    const s = ring.reduce((acc, c) => [acc[0] + c[1], acc[1] + c[0]], [0, 0]);
    return [s[0] / ring.length, s[1] / ring.length];
  }
  const seg = wg.geo[w.id]?.[0];
  if (!seg) return null;
  const p = seg[Math.floor(seg.length / 2)];
  return [p[1], p[0]];
}
