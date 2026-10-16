import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { Basemap } from './lib/basemaps';
import { fetchMany, FLOW_TTL_MS, type Reading } from './lib/flow';
import type { BaseData, LatLon, WatersGeo } from './lib/geo';
import { getPosition, km, waterMid } from './lib/geo';
import type { SalmonMap } from './lib/map';
import { RegionContext } from './lib/region';
import { addDays, isUnlisted, speciesPicksFor, statusOf, type SpeciesPick, type Status } from './lib/rules';
import { readUrl, writeUrl, type UrlState } from './lib/urlState';
import { fmtNoticeDate, recentNotices, type Notice, type NoticesFile } from './lib/notices';
import { regionEntry } from './regions';
import type { RegionData, Water } from './regions/model';
import Header from './components/Header';
import MapView from './components/MapView';
import Overview from './components/Overview';
import Panel from './components/Panel';

export type SortMode = 'status' | 'name' | 'near';
/** Device preferences. Species is deliberately not here: it is a per-trip choice carried only by the URL. */
export interface Prefs { sort: SortMode; near: string; showUn: boolean; base: Basemap }
interface DfoStatus { ok: boolean; checkedAt: string; pageModified: string | null; stale: boolean }
/** A region's module plus its geometry: everything below the header needs all three. */
interface Loaded { region: RegionData; base: BaseData; wg: WatersGeo }
const PREF_KEY = 'sw-prefs';
const NO_WATERS: Water[] = [];
const NO_FLOWS: Record<string, Reading[]> = {};
/** URL -> the five URL-backed values with defaults applied; used at first load and again on Back/Forward. */
const fromUrl = (u: Partial<UrlState>, base: Basemap): UrlState => ({ region: u.region ?? null, date: u.date ?? new Date(), sp: u.sp ?? 'any', sel: u.sel ?? null, base: u.base ?? base });
function loadPrefs(): Prefs {
  const d: Prefs = { sort: 'status', near: 'Vancouver', showUn: false, base: 'chart' };
  try { const { sp: _legacy, region: _legacy2, ...saved } = JSON.parse(localStorage.getItem(PREF_KEY) || '{}'); return { ...d, ...saved }; } catch { return d; }
}
const loadJson = <T,>(region: string, name: string, init?: RequestInit) => fetch(`${import.meta.env.BASE_URL}data/${region}/${name}`, init).then((r) => r.json() as Promise<T>);
// Status files: revalidate past the host's 10-minute HTTP cache (a conditional request, 304 when unchanged).
const LIVE: RequestInit = { cache: 'no-cache' };

export default function App() {
  const prefs0 = useMemo(loadPrefs, []);
  const url = useMemo(() => fromUrl(readUrl(), prefs0.base), [prefs0.base]);
  // Region from the URL (?r=<id>); a bare URL is the BC overview.
  const [regionId, setRegionId] = useState<string | null>(url.region);
  const [data, setData] = useState<Loaded | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [date, setDate] = useState<Date>(url.date);
  const [sp, setSp] = useState<SpeciesPick>(url.sp);
  const [sel, setSel] = useState<string | null>(url.sel);
  const [base, setBase] = useState<Basemap>(url.base);
  const [filter, setFilter] = useState<Status | null>(null);
  const [q, setQ] = useState('');
  const [sort, setSort] = useState<SortMode>(prefs0.sort);
  const [near, setNear] = useState(prefs0.near);
  const [showUn, setShowUn] = useState(prefs0.showUn);
  const [userLoc, setUserLoc] = useState<LatLon | null>(null);
  const [flows, setFlows] = useState<Record<string, Reading[]>>(NO_FLOWS);
  const [dfo, setDfo] = useState<DfoStatus | null>(null);
  const [noticeFile, setNoticeFile] = useState<NoticesFile | null>(null);
  const mapRef = useRef<SalmonMap | null>(null);
  const panelRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    setData(null); setDfo(null); setNoticeFile(null); setFlows(NO_FLOWS); setErr(null);
    const entry = regionEntry(regionId);
    if (!entry) return; // the overview
    let live = true;
    Promise.all([entry.load(), loadJson<BaseData>(entry.id, 'base.json'), loadJson<WatersGeo>(entry.id, 'waters.json')])
      .then(([region, base, wg]) => { if (live) setData({ region, base, wg }); }).catch((e) => { if (live) setErr(String(e)); });
    loadJson<DfoStatus>(entry.id, 'dfo-status.json', LIVE).then((d) => { if (live) setDfo(d); }).catch(() => { /* optional */ });
    loadJson<NoticesFile>(entry.id, 'notices.json', LIVE).then((n) => { if (live) setNoticeFile(n); }).catch(() => { /* optional */ });
    return () => { live = false; };
  }, [regionId]);
  useEffect(() => { writeUrl({ region: regionId, date, sp, sel, base }); }, [regionId, date, sp, sel, base]);
  // Back/Forward: the URL is the state.
  useEffect(() => {
    const onPop = () => {
      const u = fromUrl(readUrl(), prefs0.base);
      setRegionId(u.region); setSel(u.sel); setSp(u.sp); setDate(u.date); setBase(u.base); setFilter(null); setQ('');
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, [prefs0.base]);
  useEffect(() => { try { localStorage.setItem(PREF_KEY, JSON.stringify({ sort, near, showUn, base } satisfies Prefs)); } catch { /* ignore */ } }, [sort, near, showUn, base]);

  const region = data?.region ?? null;
  const waters = region?.waters ?? NO_WATERS;
  // "Nearest to <city>" carried over from another region: fall back to this region's main city.
  useEffect(() => { if (region && near !== 'me' && !region.cities.some((c) => c[0] === near)) setNear(region.cities[0][0]); }, [region, near]);
  // Changing region is navigation: a new history entry (which the URL effect then fills in), so Back returns here.
  const switchRegion = (id: string | null, water: string | null = null) => { if (id === regionId) return; history.pushState(null, '', location.href); setSel(water); setFilter(null); setQ(''); setRegionId(id); };
  const picks = useMemo(() => speciesPicksFor(waters), [waters]);
  // A species from the URL that this region has no rules for falls back to Any.
  useEffect(() => { if (region && !picks.some((p) => p.id === sp)) setSp('any'); }, [region, picks, sp]);
  /** Gauges shown on cards: listed waters only (unlisted rivers carry no flow chip). */
  const stations = useMemo(() => region ? [...new Set(waters.filter((w) => !isUnlisted(w)).map((w) => region.gauges[w.id]?.stn).filter((s): s is string => !!s))] : [], [region, waters]);
  // 24 h of readings for every gauged listed water; refreshed every FLOW_TTL_MS while the tab is visible.
  useEffect(() => {
    if (!stations.length) return;
    let live = true, last = 0;
    const load = () => {
      if (document.hidden || Date.now() - last < FLOW_TTL_MS) return;
      last = Date.now();
      fetchMany(stations, 24).then((r) => { if (live) setFlows(r); });
    };
    load();
    const id = setInterval(load, 60_000);
    document.addEventListener('visibilitychange', load);
    return () => { live = false; clearInterval(id); document.removeEventListener('visibilitychange', load); };
  }, [stations]);

  const status = useMemo(() => Object.fromEntries(waters.map((w) => [w.id, statusOf(w, date, sp)])) as Record<string, Status>, [waters, date, sp]);
  const origin: LatLon | null = useMemo(() => {
    if (near === 'me') return userLoc;
    const c = region?.cities.find((c) => c[0] === near);
    return c ? [c[2], c[1]] : null;
  }, [region, near, userLoc]);
  const dist = useMemo(() => {
    const m: Record<string, number> = {};
    if (!data || !origin) return m;
    waters.forEach((w) => { const p = waterMid(w, data.wg, data.base); if (p) m[w.id] = km(origin, p); });
    return m;
  }, [data, waters, origin]);

  const notices: Notice[] = useMemo(() => recentNotices(noticeFile?.ok ? noticeFile.notices : []), [noticeFile]);
  // Newest notice from the last two weeks that touches a listed water or the whole region: the "page not updated yet" case.
  const fresh = useMemo(() => recentNotices(notices, 14).find((n) => n.region || n.waters.some((id) => { const w = region?.byId.get(id); return !!w && !isUnlisted(w); })) ?? null, [region, notices]);

  const selectFromList = (id: string) => { setSel(id); mapRef.current?.zoomTo(id); };
  const selectFromMap = (id: string) => { setSel(id); };
  // Phones: after the panel swaps (list <-> detail), put its top right under the pinned map. Only on a selection change:
  // a fresh load keeps the header in view. Done after layout and with an explicit position: scrollIntoView before the
  // swap ends up clamped mid-page once the content shrinks (iOS Safari).
  const prevSel = useRef(sel);
  useLayoutEffect(() => {
    if (prevSel.current === sel) return;
    prevSel.current = sel;
    if (!data || window.innerWidth > 900) return;
    const panel = panelRef.current, map = document.querySelector('.mapwrap');
    if (!panel || !map) return;
    const top = panel.getBoundingClientRect().top + window.scrollY - map.getBoundingClientRect().height;
    window.scrollTo({ top: Math.max(0, Math.round(top)), behavior: 'auto' });
  }, [sel, data]);
  const locate = () => {
    getPosition().then((p) => { setUserLoc(p); setNear('me'); setSort('near'); mapRef.current?.setUserLocation(p[0], p[1]); }).catch(() => { /* denied: keep city-based sort */ });
  };
  // A saved "nearest to my location" preference needs a fresh position each visit.
  const wantsLocation = !!data && sort === 'near' && near === 'me' && !userLoc;
  useEffect(() => { if (wantsLocation) locate(); }, [wantsLocation]); // eslint-disable-line react-hooks/exhaustive-deps -- locate is stable enough; runs once per data load

  if (regionId === null) return <Overview date={date} onPick={switchRegion} />;
  if (err) return <div className="loading">Could not load map data: {err}</div>;
  if (!data || !region) return <div className="loading">Loading rivers…</div>;
  return (
    <RegionContext.Provider value={region}>
      <div className="app">
        <Header date={date} sp={sp} picks={picks} onDate={setDate} onShift={(n) => setDate((d) => addDays(d, n))} onToday={() => setDate(new Date())} onSp={setSp} onRegion={switchRegion} />
        {((dfo?.ok && dfo.stale) || fresh) && (
          <div className="banner" role="status">
            {dfo?.ok && dfo.stale && <span><b>Heads up:</b> DFO changed the Region {region.num} page{dfo.pageModified ? ` on ${dfo.pageModified}` : ''}; these rules were transcribed from the {region.dfo.date} version. <a href={region.dfo.url} target="_blank" rel="noopener">Check the DFO page</a> before you go.</span>}
            {fresh && <span><b>New notice {fmtNoticeDate(fresh.date)}:</b> <a href={fresh.url} target="_blank" rel="noopener">{fresh.fn}</a> {fresh.subject}</span>}
          </div>
        )}
        <div className="main">
          <MapView data={data} status={status} filter={filter} sel={sel} base={base} date={date} mapRef={mapRef} onSelect={selectFromMap} onBase={setBase} onLocate={locate} />
          <Panel ref={panelRef} date={date} sp={sp} status={status} sel={sel} filter={filter} q={q} sort={sort} near={near} showUn={showUn} dist={dist} hasUserLoc={!!userLoc} wg={data.wg} flows={flows} dfoCheckedAt={dfo?.ok ? dfo.checkedAt : null} notices={notices} noticesFetchedAt={noticeFile?.ok ? noticeFile.fetchedAt : null}
            onFilter={setFilter} onQ={setQ} onSort={setSort} onNear={setNear} onShowUn={setShowUn} onSelect={selectFromList} onBack={() => setSel(null)} onZoom={(id) => mapRef.current?.zoomTo(id)} onLocate={locate} />
        </div>
      </div>
    </RegionContext.Provider>
  );
}
