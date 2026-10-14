import L from 'leaflet';
import type { City, Unlisted, Water } from '../data/regs';
import type { BaseData, Coord, WatersGeo } from './geo';
import { STATUS_LABEL, type Status } from './rules';

export type Basemap = 'chart' | 'streets' | 'topo' | 'satellite';
export const BASEMAPS: { id: Basemap; label: string }[] = [
  { id: 'chart', label: 'Chart' }, { id: 'streets', label: 'Streets' }, { id: 'topo', label: 'Topo' }, { id: 'satellite', label: 'Satellite' },
];

interface WaterLayers { lines: L.Path[]; hit: L.Path[]; bounds: L.LatLngBounds | null; isLake: boolean }
interface Opts {
  onSelect: (id: string) => void;
  tooltip: (id: string) => string;
}

const ll = (c: Coord): L.LatLngExpression => [c[1], c[0]];
const css = (n: string) => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
const MAPTILER = import.meta.env.VITE_MAPTILER_KEY as string | undefined;
/** Extent of the bundled base data; the map cannot pan or zoom beyond it. */
const DATA_BOUNDS = L.latLngBounds([48.2, -125.6], [50.8, -120.6]);

function tileLayer(b: Basemap): L.TileLayer {
  const mt = (style: string, ext = 'png') =>
    L.tileLayer(`https://api.maptiler.com/maps/${style}/{z}/{x}/{y}.${ext}?key=${MAPTILER}`, { maxZoom: 18, attribution: '© MapTiler © OpenStreetMap contributors' });
  if (b === 'streets') return MAPTILER ? mt('streets-v2') : L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 18, attribution: '© OpenStreetMap contributors' });
  if (b === 'topo') return MAPTILER ? mt('outdoor-v2') : L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', { maxZoom: 17, subdomains: 'abc', attribution: '© OpenStreetMap contributors, SRTM · style © OpenTopoMap (CC-BY-SA)' });
  return MAPTILER ? mt('satellite', 'jpg') : L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { maxZoom: 18, attribution: 'Imagery © Esri, Maxar, Earthstar Geographics' });
}

export class SalmonMap {
  readonly map: L.Map;
  private C: Record<string, string> = {};
  private g = {
    land: L.layerGroup(), water: L.layerGroup(), rail: L.layerGroup(), roadC: L.layerGroup(), roadF: L.layerGroup(), sec: L.layerGroup(),
    labels: L.layerGroup(), un: L.layerGroup(), halo: L.layerGroup(), casing: L.layerGroup(), reg: L.layerGroup(), hit: L.layerGroup(), marks: L.layerGroup(), rlabels: L.layerGroup(),
  };
  private chartGroups: L.LayerGroup[];
  private reg: Record<string, WaterLayers> = {};
  private un: Record<string, L.Polyline[]> = {};
  private casings: L.Path[] = [];
  private lakePolys: L.Polygon[] = []; private riverPolys: L.Polygon[] = []; private landPolys: L.Polygon[] = [];
  private roadCase: [L.Polyline, boolean][] = []; private roadFill: [L.Polyline, boolean][] = []; private secLines: L.Polyline[] = []; private railLines: L.Polyline[] = [];
  private haloLayers: L.Path[] = [];
  private tiles: L.TileLayer | null = null;
  private basemap: Basemap = 'chart';
  private userMarker: L.Layer | null = null;
  private attribution: L.Control.Attribution;
  private themeMq = window.matchMedia('(prefers-color-scheme: dark)');
  private themeObs: MutationObserver;
  private lastPaint: { status: Record<string, Status>; filter: Status | null; sel: string | null } | null = null;

  constructor(el: HTMLElement, base: BaseData, wg: WatersGeo, waters: Water[], unlisted: Unlisted[], cities: City[], opts: Opts) {
    this.readColors();
    this.map = L.map(el, { preferCanvas: true, zoomControl: false, attributionControl: false, minZoom: 7, maxZoom: 18, zoomSnap: 0.5, wheelPxPerZoomLevel: 90, maxBounds: DATA_BOUNDS, maxBoundsViscosity: 1 });
    L.control.zoom({ position: 'topright' }).addTo(this.map);
    this.attribution = L.control.attribution({ position: 'bottomright', prefix: false }).addTo(this.map);
    const C = this.C;
    this.chartGroups = [this.g.land, this.g.water, this.g.rail, this.g.roadC, this.g.roadF, this.g.labels];
    [this.g.land, this.g.water, this.g.rail, this.g.roadC, this.g.roadF, this.g.labels, this.g.un, this.g.halo, this.g.casing, this.g.reg, this.g.hit].forEach((x) => x.addTo(this.map));

    base.land.forEach((rings) => this.landPolys.push(L.polygon(rings.map((r) => r.map(ll)), { fillColor: C.land, fillOpacity: 1, color: C.landedge, weight: 0.8, interactive: false }).addTo(this.g.land)));
    base.lakes.forEach((p) => this.lakePolys.push(L.polygon(p.r.map((r) => r.map(ll)), { fillColor: C.lake, fillOpacity: 1, stroke: false, interactive: false }).addTo(this.g.water)));
    base.rivers.forEach((p) => this.riverPolys.push(L.polygon(p.r.map((r) => r.map(ll)), { fillColor: C.river, fillOpacity: 1, stroke: false, interactive: false }).addTo(this.g.water)));
    base.rail.forEach((l) => this.railLines.push(L.polyline(l.c.map(ll), { color: C.rail, weight: 1, dashArray: '4 3', interactive: false }).addTo(this.g.rail)));
    base.hw.forEach((l) => {
      const f = l.p[1] === 'f';
      this.roadCase.push([L.polyline(l.c.map(ll), { color: C.roadedge, weight: f ? 4 : 3, interactive: false }).addTo(this.g.roadC), f]);
      this.roadFill.push([L.polyline(l.c.map(ll), { color: C.road, weight: f ? 2.2 : 1.6, interactive: false }).addTo(this.g.roadF), f]);
    });
    base.sec.forEach((l) => this.secLines.push(L.polyline(l.c.map(ll), { color: C.roadedge, weight: 1.2, interactive: false }).addTo(this.g.sec)));
    cities.forEach((c) => L.marker([c[2], c[1]], { icon: L.divIcon({ className: 'citylbl-wrap', html: `<div class="citylbl r${c[3]}" data-r="${c[3]}">${c[0]}</div>`, iconSize: [0, 0], iconAnchor: [0, 0] }), interactive: false, keyboard: false }).addTo(this.g.labels));

    unlisted.forEach((u) => {
      const g = wg.geo[u.id]; if (!g) return;
      this.un[u.id] = g.map((seg) => L.polyline(seg.map(ll), { color: C.none, weight: 1.6, opacity: 0.9 }).addTo(this.g.un));
      g.forEach((seg) => L.polyline(seg.map(ll), { opacity: 0, weight: 14 }).on('click', () => opts.onSelect(u.id)).bindTooltip(() => opts.tooltip(u.id), { sticky: true }).addTo(this.g.hit));
    });
    waters.forEach((w) => {
      const wl: WaterLayers = { lines: [], hit: [], bounds: null, isLake: !!w.lake };
      const add = (b: L.LatLngBounds) => { wl.bounds = wl.bounds ? wl.bounds.extend(b) : b; };
      if (w.lake) {
        base.lakes.filter((p) => p.n === w.lake).forEach((p) => {
          const latlngs = p.r.map((r) => r.map(ll));
          const poly = L.polygon(latlngs, { color: C.none, weight: 3, fillColor: C.lake, fillOpacity: 1 }).addTo(this.g.reg);
          wl.lines.push(poly); add(poly.getBounds());
          wl.hit.push(L.polygon(latlngs, { opacity: 0, fillOpacity: 0, weight: 12 }).on('click', () => opts.onSelect(w.id)).bindTooltip(() => opts.tooltip(w.id), { sticky: true }).addTo(this.g.hit));
        });
      } else {
        (wg.geo[w.id] || []).forEach((seg, i) => {
          const latlngs = seg.map(ll);
          this.casings.push(L.polyline(latlngs, { color: C.panel, weight: 7, opacity: 0.9, lineCap: 'round', lineJoin: 'round', interactive: false }).addTo(this.g.casing));
          const pl = L.polyline(latlngs, { color: C.none, weight: 4, lineCap: 'round', lineJoin: 'round' }).addTo(this.g.reg);
          wl.lines.push(pl); add(pl.getBounds());
          wl.hit.push(L.polyline(latlngs, { opacity: 0, weight: 18 }).on('click', () => opts.onSelect(w.id)).bindTooltip(() => opts.tooltip(w.id), { sticky: true }).addTo(this.g.hit));
          if (i === 0) L.tooltip({ permanent: true, direction: 'center', className: 'rlbl', interactive: false }).setLatLng(ll(seg[Math.floor(seg.length / 2)])).setContent(w.name).addTo(this.g.rlabels);
        });
      }
      this.reg[w.id] = wl;
    });
    wg.marks.forEach((m) => L.circleMarker(ll(m.c), { radius: m.k === 'i' ? 3 : 4.5, color: C.fg, weight: 2, fillColor: C.panel, fillOpacity: 1, dashArray: m.a ? '2 2' : undefined, interactive: true })
      .bindTooltip(`${m.k === 'i' ? '' : 'Boundary: '}${m.l}${m.a ? ' (approximate position)' : ''}`, { direction: 'top', offset: [0, -6] }).addTo(this.g.marks));

    this.map.on('zoomend', () => this.restyleZoom());
    this.fitMinZoom();
    this.map.fitBounds([[49.0, -123.35], [49.75, -121.6]], { padding: [10, 10] });
    this.restyleZoom();
    this.setBasemap('chart');

    const onTheme = () => this.onTheme();
    this.themeMq.addEventListener?.('change', onTheme);
    this.themeObs = new MutationObserver(onTheme);
    this.themeObs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  }

  private readColors() {
    ['sea', 'land', 'landedge', 'lake', 'river', 'road', 'roadedge', 'rail', 'open', 'cr', 'closed', 'none', 'tidal', 'fg', 'panel'].forEach((k) => { this.C[k] = css(`--${k}`); });
  }
  private onTheme() {
    this.readColors(); const C = this.C;
    this.landPolys.forEach((l) => l.setStyle({ fillColor: C.land, color: C.landedge }));
    this.lakePolys.forEach((l) => l.setStyle({ fillColor: C.lake })); this.riverPolys.forEach((l) => l.setStyle({ fillColor: C.river }));
    this.railLines.forEach((l) => l.setStyle({ color: C.rail }));
    this.roadCase.forEach(([l]) => l.setStyle({ color: C.roadedge })); this.roadFill.forEach(([l]) => l.setStyle({ color: C.road })); this.secLines.forEach((l) => l.setStyle({ color: C.roadedge }));
    Object.values(this.un).forEach((ls) => ls.forEach((l) => l.setStyle({ color: C.none })));
    Object.values(this.reg).forEach((r) => r.lines.forEach((l) => { if (r.isLake) l.setStyle({ fillColor: C.lake }); }));
    this.casings.forEach((l) => l.setStyle({ color: this.basemap === 'chart' ? C.panel : '#ffffff' }));
    this.g.marks.eachLayer((l) => (l as L.CircleMarker).setStyle({ color: C.fg, fillColor: C.panel }));
    if (this.lastPaint) this.paint(this.lastPaint.status, this.lastPaint.filter, this.lastPaint.sel);
  }

  private restyleZoom() {
    const z = this.map.getZoom();
    const rw = z < 9.5 ? 3 : z < 11.5 ? 5 : 7;
    Object.values(this.reg).forEach((r) => r.lines.forEach((l) => l.setStyle(r.isLake ? { weight: z < 10 ? 2.5 : 4 } : { weight: rw })));
    this.casings.forEach((l) => l.setStyle({ weight: rw + 3 }));
    Object.values(this.un).forEach((ls) => ls.forEach((l) => l.setStyle({ weight: z < 10 ? 1.2 : 1.8 })));
    this.roadCase.forEach(([l, f]) => l.setStyle({ weight: z < 10 ? (f ? 3 : 2.2) : f ? 5 : 3.6 }));
    this.roadFill.forEach(([l, f]) => l.setStyle({ weight: z < 10 ? (f ? 1.6 : 1) : f ? 3 : 2 }));
    const detail = z >= 10.5;
    const toggle = (g: L.LayerGroup, on: boolean) => { if (on && !this.map.hasLayer(g)) g.addTo(this.map); if (!on && this.map.hasLayer(g)) this.map.removeLayer(g); };
    toggle(this.g.sec, detail && this.basemap === 'chart'); toggle(this.g.marks, detail); toggle(this.g.rlabels, detail);
    document.querySelectorAll<HTMLElement>('.citylbl').forEach((el) => { const r = +el.dataset.r!; el.style.display = r === 1 || (r === 2 && z >= 9) || (r === 3 && z >= 10.5) ? '' : 'none'; });
    this.order();
  }
  private order() {
    const back = (g: L.LayerGroup) => g.eachLayer((l) => (l as L.Path).bringToBack?.());
    [this.g.sec, this.g.roadF, this.g.roadC, this.g.rail, this.g.water, this.g.land].forEach(back);
    [this.g.un, this.g.halo, this.g.casing, this.g.reg, this.g.hit].forEach((g) => g.eachLayer((l) => (l as L.Path).bringToFront?.()));
  }

  setBasemap(b: Basemap) {
    this.basemap = b;
    if (this.tiles) { this.map.removeLayer(this.tiles); this.tiles = null; }
    const chart = b === 'chart';
    this.chartGroups.forEach((g) => { if (chart && !this.map.hasLayer(g)) g.addTo(this.map); if (!chart && this.map.hasLayer(g)) this.map.removeLayer(g); });
    if (!chart) { this.tiles = tileLayer(b).addTo(this.map); this.tiles.bringToBack(); }
    this.attribution.setPrefix(chart ? 'Base: BC Freshwater Atlas, DRA, NTS (OGL-BC)' : false);
    this.casings.forEach((l) => l.setStyle({ color: chart ? this.C.panel : '#ffffff', opacity: chart ? 0.9 : 0.85 }));
    (this.map.getContainer()).classList.toggle('tiles', !chart);
    this.restyleZoom();
  }

  paint(status: Record<string, Status>, filter: Status | null, sel: string | null) {
    this.lastPaint = { status, filter, sel };
    const C = this.C;
    Object.entries(this.reg).forEach(([id, r]) => {
      const st = status[id] ?? 'none'; const dim = !!filter && filter !== st;
      r.lines.forEach((l) => l.setStyle({ color: C[st] || C.none, opacity: dim ? 0.25 : 1 }));
    });
    this.haloLayers.forEach((h) => this.g.halo.removeLayer(h)); this.haloLayers = [];
    const halo = (l: L.Path, isPoly: boolean) => {
      const latlngs = (l as L.Polyline).getLatLngs() as L.LatLngExpression[];
      const h = isPoly ? L.polygon(latlngs, { color: C.fg, weight: 9, opacity: 0.35, fill: false, interactive: false }) : L.polyline(latlngs, { color: C.fg, weight: ((l.options as L.PolylineOptions).weight || 5) + 8, opacity: 0.3, lineCap: 'round', interactive: false });
      h.addTo(this.g.halo); this.haloLayers.push(h);
    };
    if (sel && this.reg[sel]) this.reg[sel].lines.forEach((l) => halo(l, this.reg[sel].isLake));
    if (sel && this.un[sel]) this.un[sel].forEach((l) => halo(l, false));
    this.order();
  }

  zoomTo(id: string) {
    const r = this.reg[id];
    if (r?.bounds) { this.map.fitBounds(r.bounds, { padding: [40, 40], maxZoom: 13 }); return; }
    const u = this.un[id];
    if (u) { let b: L.LatLngBounds | null = null; u.forEach((l) => { b = b ? b.extend(l.getBounds()) : l.getBounds(); }); if (b) this.map.fitBounds(b, { padding: [40, 40], maxZoom: 12 }); }
  }

  setUserLocation(lat: number, lon: number) {
    if (this.userMarker) this.map.removeLayer(this.userMarker);
    this.userMarker = L.circleMarker([lat, lon], { radius: 7, color: '#fff', weight: 2, fillColor: this.C.tidal, fillOpacity: 1 }).bindTooltip('You are here').addTo(this.map);
    this.map.setView([lat, lon], Math.max(this.map.getZoom(), 10));
  }

  /** Never let the viewport grow past the data extent (which would show the clipped edge). */
  private fitMinZoom() { this.map.setMinZoom(Math.max(7, this.map.getBoundsZoom(DATA_BOUNDS, true))); }
  invalidate() { this.map.invalidateSize(); this.fitMinZoom(); }
  destroy() { this.themeObs.disconnect(); this.map.remove(); }
}
export { STATUS_LABEL };
