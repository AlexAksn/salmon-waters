import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CITIES, SOURCE_DATE, SOURCE_TABLE_HASH, SOURCE_URL, UNLISTED, WATERS } from './data/regs';
import { GAUGES } from './data/gauges';
import { fetchMany, type Reading } from './lib/flow';
import type { BaseData, LatLon, WatersGeo } from './lib/geo';
import { km, waterMid } from './lib/geo';
import type { Basemap, SalmonMap } from './lib/map';
import { addDays, statusOf, type SpeciesPick, type Status } from './lib/rules';
import { readUrl, writeUrl } from './lib/urlState';
import Header from './components/Header';
import MapView from './components/MapView';
import Panel from './components/Panel';

export type SortMode = 'status' | 'name' | 'near';
export interface Prefs { sp: SpeciesPick; sort: SortMode; near: string; showUn: boolean; base: Basemap }
const PREF_KEY = 'sw-prefs';
function loadPrefs(): Prefs {
  const d: Prefs = { sp: 'any', sort: 'status', near: 'Vancouver', showUn: false, base: 'chart' };
  try { return { ...d, ...JSON.parse(localStorage.getItem(PREF_KEY) || '{}') }; } catch { return d; }
}

export default function App() {
  const [data, setData] = useState<{ base: BaseData; wg: WatersGeo } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const url = useMemo(readUrl, []);
  const prefs0 = useMemo(loadPrefs, []);
  const [date, setDate] = useState<Date>(url.date ?? new Date());
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const [sp, setSp] = useState<SpeciesPick>(url.sp ?? prefs0.sp);
  const [sel, setSel] = useState<string | null>(url.sel ?? null);
  const [base, setBase] = useState<Basemap>(url.base ?? prefs0.base);
  const [filter, setFilter] = useState<Status | null>(null);
  const [q, setQ] = useState('');
  const [sort, setSort] = useState<SortMode>(prefs0.sort);
  const [near, setNear] = useState(prefs0.near);
  const [showUn, setShowUn] = useState(prefs0.showUn);
  const [userLoc, setUserLoc] = useState<LatLon | null>(null);
  const [flows, setFlows] = useState<Record<string, Reading[]>>({});
  const [dfo, setDfo] = useState<{ ok: boolean; checkedAt: string; pageModified: string | null; tableHash: string | null } | null>(null);
  const mapRef = useRef<SalmonMap | null>(null);
  const panelRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const b = import.meta.env.BASE_URL;
    Promise.all([fetch(`${b}data/base.json`).then((r) => r.json()), fetch(`${b}data/waters.json`).then((r) => r.json())])
      .then(([base, wg]) => setData({ base, wg }))
      .catch((e) => setErr(String(e)));
  }, []);
  useEffect(() => { writeUrl({ date, sp, sel, base }); }, [date, sp, sel, base]);
  // 24 h of readings for every gauged water (cards show current flow + trend); refreshed every 10 min.
  useEffect(() => {
    let live = true;
    const load = () => fetchMany(Object.values(GAUGES).map((g) => g.stn), 24).then((r) => { if (live) setFlows(r); });
    load(); const id = setInterval(load, 10 * 60_000);
    return () => { live = false; clearInterval(id); };
  }, []);
  useEffect(() => { fetch(`${import.meta.env.BASE_URL}data/dfo-status.json`).then((r) => r.json()).then(setDfo).catch(() => { /* optional */ }); }, []);
  useEffect(() => { try { localStorage.setItem(PREF_KEY, JSON.stringify({ sp, sort, near, showUn, base } satisfies Prefs)); } catch { /* ignore */ } }, [sp, sort, near, showUn, base]);

  const status = useMemo(() => {
    const m: Record<string, Status> = {};
    WATERS.forEach((w) => { m[w.id] = statusOf(w, date, sp); });
    UNLISTED.forEach((u) => { m[u.id] = 'none'; });
    return m;
  }, [date, sp]);

  const origin: LatLon | null = useMemo(() => {
    if (near === 'me') return userLoc;
    const c = CITIES.find((c) => c[0] === near);
    return c ? [c[2], c[1]] : null;
  }, [near, userLoc]);
  const dist = useMemo(() => {
    const m: Record<string, number> = {};
    if (!data || !origin) return m;
    WATERS.forEach((w) => { const p = waterMid(w, data.wg, data.base); if (p) m[w.id] = km(origin, p); });
    return m;
  }, [data, origin]);

  const select = useCallback((id: string | null, zoom: boolean, fromMap = false) => {
    setSel(id);
    if (id && zoom) mapRef.current?.zoomTo(id);
    if (id && fromMap && window.innerWidth <= 900) panelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);
  const locate = useCallback(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => { const p: LatLon = [pos.coords.latitude, pos.coords.longitude]; setUserLoc(p); setNear('me'); setSort('near'); mapRef.current?.setUserLocation(p[0], p[1]); },
      () => { /* denied: keep city-based sort */ },
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 300000 },
    );
  }, []);

  // A saved "nearest to my location" preference needs a fresh position each visit.
  useEffect(() => { if (data && sort === 'near' && near === 'me' && !userLoc) locate(); }, [data]); // eslint-disable-line react-hooks/exhaustive-deps

  const stale = !!dfo?.ok && ((dfo.pageModified != null && dfo.pageModified > SOURCE_DATE) || (dfo.tableHash != null && dfo.tableHash !== SOURCE_TABLE_HASH));

  if (err) return <div className="loading">Could not load map data: {err}</div>;
  if (!data) return <div className="loading">Loading rivers…</div>;
  return (
    <div className="app">
      <Header date={date} sp={sp} onDate={setDate} onShift={(n) => setDate((d) => addDays(d, n))} onToday={() => setDate(new Date())} onSp={setSp} />
      {stale && (
        <div className="banner" role="status"><b>Heads up:</b> DFO changed the Region 2 page{dfo?.pageModified ? ` on ${dfo.pageModified}` : ''}; these rules were transcribed from the {SOURCE_DATE} version. <a href={SOURCE_URL} target="_blank" rel="noopener">Check the DFO page</a> before you go.</div>
      )}
      <div className="main">
        <MapView data={data} status={status} filter={filter} sel={sel} base={base} date={date} sp={sp}
          onReady={(m) => { mapRef.current = m; if (url.sel) m.zoomTo(url.sel); }}
          onSelect={(id) => select(id, false, true)} onBase={setBase} onLocate={locate} />
        <Panel ref={panelRef} date={date} sp={sp} status={status} sel={sel} filter={filter} q={q} sort={sort} near={near} showUn={showUn} dist={dist} hasUserLoc={!!userLoc} wg={data.wg} flows={flows} dfoCheckedAt={dfo?.ok ? dfo.checkedAt : null}
          onFilter={setFilter} onQ={setQ} onSort={setSort} onNear={setNear} onShowUn={setShowUn} onSelect={(id) => select(id, true)} onBack={() => setSel(null)} onZoom={(id) => mapRef.current?.zoomTo(id)} onLocate={locate} />
      </div>
    </div>
  );
}
