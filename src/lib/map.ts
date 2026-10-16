import L from 'leaflet';
import type { City, Water } from '../regions/model';
import type { Basemap } from './basemaps';
import { toLatLon, type BaseData, type Coord, type WatersGeo } from './geo';
import { isUnlisted, type Status } from './rules';

interface WaterLayers { lines: L.Path[]; hit: L.Path[]; thin: boolean; isLake: boolean }
interface Opts { home: L.LatLngBoundsLiteral; onSelect: (id: string) => void; tooltip: (id: string) => string }

const ll = (c: Coord): L.LatLngExpression => toLatLon(c);
const css = (n: string) => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
const MAPTILER = import.meta.env.VITE_MAPTILER_KEY as string | undefined;
/** Hover tooltips only where a pointer can hover; on touch they would stick open after a tap. */
const HOVER = window.matchMedia('(hover: hover)').matches;
const COLOR_KEYS = ['land', 'landedge', 'lake', 'river', 'road', 'roadedge', 'rail', 'open', 'cr', 'closed', 'none', 'tidal', 'fg', 'panel'] as const;
type Colors = Record<(typeof COLOR_KEYS)[number], string>;
/** Panes bottom to top. Each has its own canvas, so repainting status lines never redraws the base map. */
const PANES = { land: 300, sec: 310, roads: 320, un: 340, halo: 350, reg: 400, hit: 450 } as const;
type Pane = keyof typeof PANES;

function tileLayer(b: Basemap): L.TileLayer {
  const mt = (style: string, ext = 'png') =>
    L.tileLayer(`https://api.maptiler.com/maps/${style}/{z}/{x}/{y}.${ext}?key=${MAPTILER}`, { maxZoom: 18, attribution: '© MapTiler © OpenStreetMap contributors' });
  if (b === 'streets') return MAPTILER ? mt('streets-v2') : L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 18, attribution: '© OpenStreetMap contributors' });
  if (b === 'topo') return MAPTILER ? mt('outdoor-v2') : L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', { maxZoom: 17, subdomains: 'abc', attribution: '© OpenStreetMap contributors, SRTM · style © OpenTopoMap (CC-BY-SA)' });
  return MAPTILER ? mt('satellite', 'jpg') : L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { maxZoom: 18, attribution: 'Imagery © Esri, Maxar, Earthstar Geographics' });
}

// Leaflet queues one last canvas redraw while a map is being removed; the frame then runs on a renderer whose
// 2D context is already gone and throws. Harmless, but noisy under React StrictMode (mount, unmount, mount), so bail.
{
  const proto = L.Canvas.prototype as unknown as { _redraw: () => void; _ctx?: unknown };
  const redraw = proto._redraw;
  proto._redraw = function (this: typeof proto) { if (this._ctx) redraw.call(this); };
}
export class SalmonMap {
  readonly map: L.Map;
  private C = {} as Colors;
  private R = {} as Record<Pane, L.Canvas>;
  private g = { chart: L.layerGroup(), sec: L.layerGroup(), un: L.layerGroup(), halo: L.layerGroup(), reg: L.layerGroup(), hit: L.layerGroup(), marks: L.layerGroup(), rlabels: L.layerGroup() };
  // One merged layer per base style: theme and zoom restyles touch ~10 objects instead of ~19k.
  private base: { land: L.Polygon; lakes: L.Polygon; rivers: L.Polygon; rail: L.Polyline; sec: L.Polyline; roadC: Record<'f' | 'h', L.Polyline>; roadF: Record<'f' | 'h', L.Polyline> };
  private casing: L.Polyline;
  private waters: Record<string, WaterLayers> = {};
  private dataBounds: L.LatLngBounds;
  private home: L.LatLngBounds;
  private tiles: L.TileLayer | null = null;
  private basemap: Basemap = 'chart';
  private userMarker: L.Layer | null = null;
  private attribution: L.Control.Attribution;
  private themeMq = window.matchMedia('(prefers-color-scheme: dark)');
  private onTheme = () => this.applyTheme();
  private zoomBand = '';
  private lastPaint: { status: Record<string, Status>; filter: Status | null; sel: string | null } | null = null;

  constructor(el: HTMLElement, data: BaseData, wg: WatersGeo, waters: Water[], cities: City[], opts: Opts) {
    this.readColors();
    const [minLon, minLat, maxLon, maxLat] = data.bbox;
    this.dataBounds = L.latLngBounds([minLat, minLon], [maxLat, maxLon]);
    this.home = L.latLngBounds(opts.home);
    this.map = L.map(el, { preferCanvas: true, zoomControl: false, attributionControl: false, minZoom: 7, maxZoom: 18, zoomSnap: 0.5, wheelPxPerZoomLevel: 90, maxBounds: this.dataBounds, maxBoundsViscosity: 1 });
    L.control.zoom({ position: 'topright' }).addTo(this.map);
    this.attribution = L.control.attribution({ position: 'bottomright', prefix: false }).addTo(this.map);
    for (const [name, z] of Object.entries(PANES)) { this.map.createPane(name).style.zIndex = String(z); this.R[name as Pane] = L.canvas({ pane: name }); }
    const C = this.C, R = this.R;
    const quiet = { interactive: false } as const;
    const multi = (polys: Coord[][][]) => polys.map((rings) => rings.map((r) => r.map(ll)));
    const lines = (ls: Coord[][]) => ls.map((l) => l.map(ll));

    this.base = {
      land: L.polygon(multi(data.land), { renderer: R.land, fillColor: C.land, fillOpacity: 1, color: C.landedge, weight: 0.8, ...quiet }),
      lakes: L.polygon(multi(data.lakes.map((p) => p.r)), { renderer: R.land, fillColor: C.lake, fillOpacity: 1, stroke: false, ...quiet }),
      rivers: L.polygon(multi(data.rivers.map((p) => p.r)), { renderer: R.land, fillColor: C.river, fillOpacity: 1, stroke: false, ...quiet }),
      rail: L.polyline(lines(data.rail.map((l) => l.c)), { renderer: R.roads, color: C.rail, weight: 1, dashArray: '4 3', ...quiet }),
      sec: L.polyline(lines(data.sec.map((l) => l.c)), { renderer: R.sec, color: C.roadedge, weight: 1.2, ...quiet }),
      roadC: { f: L.polyline([], { renderer: R.roads, color: C.roadedge, ...quiet }), h: L.polyline([], { renderer: R.roads, color: C.roadedge, ...quiet }) },
      roadF: { f: L.polyline([], { renderer: R.roads, color: C.road, ...quiet }), h: L.polyline([], { renderer: R.roads, color: C.road, ...quiet }) },
    };
    for (const cls of ['f', 'h'] as const) {
      const ls = lines(data.hw.filter((l) => l.p[1] === cls).map((l) => l.c));
      this.base.roadC[cls].setLatLngs(ls); this.base.roadF[cls].setLatLngs(ls);
    }
    [this.base.land, this.base.lakes, this.base.rivers, this.base.rail, this.base.roadC.f, this.base.roadC.h, this.base.roadF.f, this.base.roadF.h].forEach((l) => l.addTo(this.g.chart));
    this.base.sec.addTo(this.g.sec);
    cities.forEach((c) => L.marker([c[2], c[1]], { icon: L.divIcon({ className: 'citylbl-wrap', html: `<div class="citylbl r${c[3]}">${c[0]}</div>`, iconSize: [0, 0], iconAnchor: [0, 0] }), interactive: false, keyboard: false }).addTo(this.g.chart));

    // Canvas draw order follows layer creation order, so the casing is created (and added) before the status lines it sits under.
    this.casing = L.polyline([], { renderer: R.reg, color: C.panel, weight: 7, opacity: 0.9, lineCap: 'round', lineJoin: 'round', ...quiet }).addTo(this.g.reg);
    const casingLines: L.LatLngExpression[][] = [];
    const labelled = new Set<string>(); // one label per river, not per regulated stretch
    for (const w of waters) {
      const thin = isUnlisted(w);
      const wl: WaterLayers = { lines: [], hit: [], thin, isLake: !!w.lake };
      const hitOpts = { renderer: R.hit, opacity: 0, weight: thin ? 14 : 18 };
      const bindHit = (h: L.Path) => { h.on('click', () => opts.onSelect(w.id)); if (HOVER) h.bindTooltip(() => opts.tooltip(w.id), { sticky: true }); return h.addTo(this.g.hit); };
      if (w.lake) {
        for (const p of data.lakes.filter((p) => p.n === w.lake)) {
          const latlngs = p.r.map((r) => r.map(ll));
          wl.lines.push(L.polygon(latlngs, { renderer: R.reg, color: C.none, weight: 3, fillColor: C.lake, fillOpacity: 1 }).addTo(this.g.reg));
          wl.hit.push(bindHit(L.polygon(latlngs, { ...hitOpts, fillOpacity: 0, weight: 12 })));
        }
      } else {
        (wg.geo[w.id] || []).forEach((seg, i) => {
          const latlngs = seg.map(ll);
          if (!thin) casingLines.push(latlngs);
          wl.lines.push(L.polyline(latlngs, thin ? { renderer: R.un, color: C.none, weight: 1.6, opacity: 0.9 } : { renderer: R.reg, color: C.none, weight: 4, lineCap: 'round', lineJoin: 'round' }).addTo(thin ? this.g.un : this.g.reg));
          wl.hit.push(bindHit(L.polyline(latlngs, hitOpts)));
          if (i === 0 && !thin && !labelled.has(w.name)) { labelled.add(w.name); L.tooltip({ permanent: true, direction: 'center', className: 'rlbl', interactive: false }).setLatLng(ll(seg[Math.floor(seg.length / 2)])).setContent(w.name).addTo(this.g.rlabels); }
        });
      }
      this.waters[w.id] = wl;
    }
    this.casing.setLatLngs(casingLines);
    wg.marks.forEach((m) => L.circleMarker(ll(m.c), { renderer: R.hit, radius: m.k === 'i' ? 3 : 4.5, color: C.fg, weight: 2, fillColor: C.panel, fillOpacity: 1, dashArray: m.a ? '2 2' : undefined })
      .bindTooltip(`${m.k === 'i' ? '' : 'Boundary: '}${m.l}${m.a ? ' (approximate position)' : ''}`, { direction: 'top', offset: [0, -6] }).addTo(this.g.marks));

    [this.g.un, this.g.halo, this.g.reg, this.g.hit].forEach((x) => x.addTo(this.map));
    this.map.on('zoomend', () => this.restyleZoom());
    this.fitMinZoom();
    this.map.fitBounds(this.home, { padding: [10, 10] });
    this.setBasemap('chart');
    this.themeMq.addEventListener?.('change', this.onTheme);
  }

  private readColors() { for (const k of COLOR_KEYS) this.C[k] = css(`--${k}`); }
  private casingColor() { return this.basemap === 'chart' ? this.C.panel : '#ffffff'; }
  private show(g: L.LayerGroup, on: boolean) { if (on !== this.map.hasLayer(g)) { if (on) g.addTo(this.map); else this.map.removeLayer(g); } }

  private applyTheme() {
    this.readColors(); const C = this.C, b = this.base;
    b.land.setStyle({ fillColor: C.land, color: C.landedge }); b.lakes.setStyle({ fillColor: C.lake }); b.rivers.setStyle({ fillColor: C.river });
    b.rail.setStyle({ color: C.rail }); b.sec.setStyle({ color: C.roadedge });
    for (const cls of ['f', 'h'] as const) { b.roadC[cls].setStyle({ color: C.roadedge }); b.roadF[cls].setStyle({ color: C.road }); }
    this.casing.setStyle({ color: this.casingColor() });
    Object.values(this.waters).forEach((w) => { if (w.isLake) w.lines.forEach((l) => l.setStyle({ fillColor: C.lake })); });
    this.g.marks.eachLayer((l) => (l as L.CircleMarker).setStyle({ color: C.fg, fillColor: C.panel }));
    if (this.lastPaint) this.paint(this.lastPaint.status, this.lastPaint.filter, this.lastPaint.sel);
  }

  private restyleZoom() {
    const z = this.map.getZoom();
    const rw = z < 9.5 ? 3 : z < 11.5 ? 5 : 7, detail = z >= 10.5, city = z < 9 ? 0 : z < 10.5 ? 1 : 2;
    const band = `${rw}|${detail}|${city}|${this.basemap}`;
    if (band === this.zoomBand) return;
    this.zoomBand = band;
    Object.values(this.waters).forEach((w) => w.lines.forEach((l) => l.setStyle({ weight: w.isLake ? (detail ? 4 : 2.5) : w.thin ? (detail ? 1.8 : 1.2) : rw })));
    this.casing.setStyle({ weight: rw + 3 });
    for (const cls of ['f', 'h'] as const) {
      const f = cls === 'f';
      this.base.roadC[cls].setStyle({ weight: z < 10 ? (f ? 3 : 2.2) : f ? 5 : 3.6 });
      this.base.roadF[cls].setStyle({ weight: z < 10 ? (f ? 1.6 : 1) : f ? 3 : 2 });
    }
    this.show(this.g.sec, detail && this.basemap === 'chart'); this.show(this.g.marks, detail); this.show(this.g.rlabels, detail);
    const el = this.map.getContainer(); el.classList.remove('zb0', 'zb1', 'zb2'); el.classList.add(`zb${city}`);
  }

  setBasemap(b: Basemap) {
    this.basemap = b;
    if (this.tiles) { this.map.removeLayer(this.tiles); this.tiles = null; }
    const chart = b === 'chart';
    this.show(this.g.chart, chart);
    if (!chart) this.tiles = tileLayer(b).addTo(this.map);
    this.attribution.setPrefix(chart ? 'Base: BC Freshwater Atlas, DRA, NTS (OGL-BC)' : false);
    this.casing.setStyle({ color: this.casingColor(), opacity: chart ? 0.9 : 0.85 });
    this.map.getContainer().classList.toggle('tiles', !chart);
    this.restyleZoom();
  }

  paint(status: Record<string, Status>, filter: Status | null, sel: string | null) {
    this.lastPaint = { status, filter, sel };
    const C = this.C;
    for (const [id, w] of Object.entries(this.waters)) {
      if (w.thin) continue;
      const st = status[id] ?? 'none', dim = !!filter && filter !== st;
      w.lines.forEach((l) => l.setStyle({ color: C[st] || C.none, opacity: dim ? 0.25 : 1 }));
    }
    this.g.halo.clearLayers();
    const w = sel ? this.waters[sel] : null;
    w?.lines.forEach((l) => {
      const latlngs = (l as L.Polyline).getLatLngs() as L.LatLngExpression[];
      const h = w.isLake ? L.polygon(latlngs, { renderer: this.R.halo, color: C.fg, weight: 9, opacity: 0.35, fill: false, interactive: false })
        : L.polyline(latlngs, { renderer: this.R.halo, color: C.fg, weight: ((l.options as L.PolylineOptions).weight || 5) + 8, opacity: 0.3, lineCap: 'round', interactive: false });
      h.addTo(this.g.halo);
    });
  }

  zoomTo(id: string, animate = true) {
    const w = this.waters[id]; if (!w?.lines.length) return;
    this.map.fitBounds(L.featureGroup(w.lines).getBounds(), { padding: [40, 40], maxZoom: w.thin ? 12 : 13, animate });
  }
  setUserLocation(lat: number, lon: number) {
    if (this.userMarker) this.map.removeLayer(this.userMarker);
    this.userMarker = L.circleMarker([lat, lon], { radius: 7, color: '#fff', weight: 2, fillColor: this.C.tidal, fillOpacity: 1 }).bindTooltip('You are here').addTo(this.map);
    this.map.setView([lat, lon], Math.max(this.map.getZoom(), 10));
  }
  /** Never let the viewport grow past the data extent (which would show the clipped edge), except as far as needed to
   * show the region's home view in full (a region whose home view is its whole extent, like Vancouver Island). */
  private fitMinZoom() { this.map.setMinZoom(Math.max(7, Math.min(this.map.getBoundsZoom(this.dataBounds, true), this.map.getBoundsZoom(this.home, false)))); }
  invalidate() { this.map.invalidateSize(); this.fitMinZoom(); }
  destroy() {
    this.themeMq.removeEventListener?.('change', this.onTheme);
    this.map.remove();
  }
}
