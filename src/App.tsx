import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { CITIES, SOURCE_DATE, SOURCE_URL, WATERS } from './data/regs';
import { GAUGES } from './data/gauges';
import type { Basemap } from './lib/basemaps';
import { fetchMany, FLOW_TTL_MS, type Reading } from './lib/flow';
import type { BaseData, LatLon, WatersGeo } from './lib/geo';
import { km, waterMid } from './lib/geo';
import type { SalmonMap } from './lib/map';
import { addDays, isUnlisted, statusOf, type SpeciesPick, type Status } from './lib/rules';
import { readUrl, writeUrl } from './lib/urlState';
import { fmtNoticeDate, isUnlistedId, recentNotices, type Notice, type NoticesFile } from './lib/notices';
import Header from './components/Header';
import MapView from './components/MapView';
import Panel from './components/Panel';

export type SortMode = 'status' | 'name' | 'near';
/** Device preferences. Species is deliberately not here: it is a per-trip choice carried only by the URL. */
export interface Prefs { sort: SortMode; near: string; showUn: boolean; base: Basemap }
interface DfoStatus { ok: boolean; checkedAt: string; pageModified: string | null; stale: boolean }
const PREF_KEY = 'sw-prefs';
function loadPrefs(): Prefs {
  const d: Prefs = { sort: 'status', near: 'Vancouver', showUn: false, base: 'chart' };
  try { const { sp: _legacy, ...saved } = JSON.parse(localStorage.getItem(PREF_KEY) || '{}'); return { ...d, ...saved }; } catch { return d; }
}
const loadJson = <T,>(name: string, init?: RequestInit) => fetch(`${import.meta.env.BASE_URL}data/${name}`, init).then((r) => r.json() as Promise<T>);
// Status files: revalidate past the host's 10-minute HTTP cache (a conditional request, 304 when unchanged).
const LIVE: RequestInit = { cache: 'no-cache' };
/** Gauges shown on cards: listed waters only (unlisted rivers carry no flow chip). */
const CARD_STATIONS = [...new Set(WATERS.filter((w) => !isUnlisted(w)).map((w) => GAUGES[w.id]?.stn).filter((s): s is string => !!s))];

export default function App() {
  const [data, setData] = useState<{ base: BaseData; wg: WatersGeo } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const url = useMemo(readUrl, []);
  const prefs0 = useMemo(loadPrefs, []);
  const [date, setDate] = useState<Date>(url.date ?? new Date());
  const [sp, setSp] = useState<SpeciesPick>(url.sp ?? 'any');
  const [sel, setSel] = useState<string | null>(url.sel ?? null);
  const [base, setBase] = useState<Basemap>(url.base ?? prefs0.base);
  const [filter, setFilter] = useState<Status | null>(null);
  const [q, setQ] = useState('');
  const [sort, setSort] = useState<SortMode>(prefs0.sort);
  const [near, setNear] = useState(prefs0.near);
  const [showUn, setShowUn] = useState(prefs0.showUn);
  const [userLoc, setUserLoc] = useState<LatLon | null>(null);
  const [flows, setFlows] = useState<Record<string, Reading[]>>({});
  const [dfo, setDfo] = useState<DfoStatus | null>(null);
  const [noticeFile, setNoticeFile] = useState<NoticesFile | null>(null);
  const mapRef = useRef<SalmonMap | null>(null);
  const panelRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    Promise.all([loadJson<BaseData>('base.json'), loadJson<WatersGeo>('waters.json')])
      .then(([base, wg]) => setData({ base, wg })).catch((e) => setErr(String(e)));
    loadJson<DfoStatus>('dfo-status.json', LIVE).then(setDfo).catch(() => { /* optional */ });
    loadJson<NoticesFile>('notices.json', LIVE).then(setNoticeFile).catch(() => { /* optional */ });
  }, []);
  useEffect(() => { writeUrl({ date, sp, sel, base }); }, [date, sp, sel, base]);
  useEffect(() => { try { localStorage.setItem(PREF_KEY, JSON.stringify({ sort, near, showUn, base } satisfies Prefs)); } catch { /* ignore */ } }, [sort, near, showUn, base]);
  // 24 h of readings for every gauged listed water; refreshed every FLOW_TTL_MS while the tab is visible.
  useEffect(() => {
    let live = true, last = 0;
    const load = () => {
      if (document.hidden || Date.now() - last < FLOW_TTL_MS) return;
      last = Date.now();
      fetchMany(CARD_STATIONS, 24).then((r) => { if (live) setFlows(r); });
    };
    load();
    const id = setInterval(load, 60_000);
    document.addEventListener('visibilitychange', load);
    return () => { live = false; clearInterval(id); document.removeEventListener('visibilitychange', load); };
  }, []);

  const status = useMemo(() => Object.fromEntries(WATERS.map((w) => [w.id, statusOf(w, date, sp)])) as Record<string, Status>, [date, sp]);
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

  const notices: Notice[] = useMemo(() => recentNotices(noticeFile?.ok ? noticeFile.notices : []), [noticeFile]);
  // Newest notice from the last two weeks that touches a listed water or the whole region: the "page not updated yet" case.
  const fresh = useMemo(() => recentNotices(notices, 14).find((n) => n.region || n.waters.some((id) => !isUnlistedId(id))) ?? null, [notices]);

  const selectFromList = (id: string) => { setSel(id); mapRef.current?.zoomTo(id); };
  const selectFromMap = (id: string) => { setSel(id); };
  // Phones: after the panel re-renders (list <-> detail), put its top right under the pinned map. Done after layout and
  // with an explicit position: scrollIntoView before the swap ends up clamped mid-page once the content shrinks (iOS Safari).
  useLayoutEffect(() => {
    if (!data || window.innerWidth > 900) return;
    const panel = panelRef.current, map = document.querySelector('.mapwrap');
    if (!panel || !map) return;
    const top = panel.getBoundingClientRect().top + window.scrollY - map.getBoundingClientRect().height;
    window.scrollTo({ top: Math.max(0, Math.round(top)), behavior: 'auto' });
  }, [sel, data]);
  const locate = () => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => { const p: LatLon = [pos.coords.latitude, pos.coords.longitude]; setUserLoc(p); setNear('me'); setSort('near'); mapRef.current?.setUserLocation(p[0], p[1]); },
      () => { /* denied: keep city-based sort */ },
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 300000 },
    );
  };
  // A saved "nearest to my location" preference needs a fresh position each visit.
  const wantsLocation = !!data && sort === 'near' && near === 'me' && !userLoc;
  useEffect(() => { if (wantsLocation) locate(); }, [wantsLocation]); // eslint-disable-line react-hooks/exhaustive-deps -- locate is stable enough; runs once per data load

  if (err) return <div className="loading">Could not load map data: {err}</div>;
  if (!data) return <div className="loading">Loading rivers…</div>;
  return (
    <div className="app">
      <Header date={date} sp={sp} onDate={setDate} onShift={(n) => setDate((d) => addDays(d, n))} onToday={() => setDate(new Date())} onSp={setSp} />
      {((dfo?.ok && dfo.stale) || fresh) && (
        <div className="banner" role="status">
          {dfo?.ok && dfo.stale && <span><b>Heads up:</b> DFO changed the Region 2 page{dfo.pageModified ? ` on ${dfo.pageModified}` : ''}; these rules were transcribed from the {SOURCE_DATE} version. <a href={SOURCE_URL} target="_blank" rel="noopener">Check the DFO page</a> before you go.</span>}
          {fresh && <span><b>New notice {fmtNoticeDate(fresh.date)}:</b> <a href={fresh.url} target="_blank" rel="noopener">{fresh.fn}</a> {fresh.subject}</span>}
        </div>
      )}
      <div className="main">
        <MapView data={data} status={status} filter={filter} sel={sel} base={base} date={date} mapRef={mapRef} onSelect={selectFromMap} onBase={setBase} onLocate={locate} />
        <Panel ref={panelRef} date={date} sp={sp} status={status} sel={sel} filter={filter} q={q} sort={sort} near={near} showUn={showUn} dist={dist} hasUserLoc={!!userLoc} wg={data.wg} flows={flows} dfoCheckedAt={dfo?.ok ? dfo.checkedAt : null} notices={notices} noticesFetchedAt={noticeFile?.ok ? noticeFile.fetchedAt : null}
          onFilter={setFilter} onQ={setQ} onSort={setSort} onNear={setNear} onShowUn={setShowUn} onSelect={selectFromList} onBack={() => setSel(null)} onZoom={(id) => mapRef.current?.zoomTo(id)} onLocate={locate} />
      </div>
    </div>
  );
}
