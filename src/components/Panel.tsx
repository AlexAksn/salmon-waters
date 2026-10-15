import { forwardRef, useEffect, useRef, useState } from 'react';
import type { SortMode } from '../App';
import { CITIES, GLOBAL_RULES, SOURCE_DATE, SOURCE_URL, WATERS } from '../data/regs';
import { GAUGES } from '../data/gauges';
import type { Reading } from '../lib/flow';
import type { WatersGeo } from '../lib/geo';
import { isUnlisted, STATUS_ORDER, WATER_BY_ID, type SpeciesPick, type Status } from '../lib/rules';
import ChangingSoon from './ChangingSoon';
import Notices from './Notices';
import { noticesFor, regionNotices, type Notice } from '../lib/notices';
import WaterCard from './WaterCard';
import WaterDetail from './WaterDetail';

interface Props {
  date: Date; sp: SpeciesPick; status: Record<string, Status>; sel: string | null; filter: Status | null; q: string; sort: SortMode; near: string; showUn: boolean;
  dist: Record<string, number>; hasUserLoc: boolean; wg: WatersGeo; flows: Record<string, Reading[]>; dfoCheckedAt: string | null; notices: Notice[]; noticesFetchedAt: string | null;
  onFilter: (f: Status | null) => void; onQ: (q: string) => void; onSort: (s: SortMode) => void; onNear: (n: string) => void; onShowUn: (b: boolean) => void;
  onSelect: (id: string) => void; onBack: () => void; onZoom: (id: string) => void; onLocate: () => void;
}
const SUMMARY: [Status, string][] = [['open', 'open'], ['cr', 'catch & release'], ['closed', 'closed']];
const LISTED = WATERS.filter((w) => !isUnlisted(w)), UNLISTED = WATERS.filter(isUnlisted);
const byName = (a: { name: string; sub?: string }, b: { name: string; sub?: string }) => a.name.localeCompare(b.name) || (a.sub || '').localeCompare(b.sub || '');

const LEGEND: [Status, string][] = [['open', 'Open'], ['cr', 'Catch & release'], ['closed', 'Closed'], ['none', 'Not listed'], ['tidal', 'Tidal']];

const Panel = forwardRef<HTMLElement, Props>(function Panel(p, ref) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [footOpen, setFootOpen] = useState(false);
  useEffect(() => { if (scrollRef.current) scrollRef.current.scrollTop = 0; }, [p.sel]); // a newly opened detail starts at its top
  const counts: Record<string, number> = { open: 0, cr: 0, closed: 0 };
  LISTED.forEach((w) => { const s = p.status[w.id]; if (s in counts) counts[s]++; });
  const q = p.q.trim().toLowerCase();
  const matches = (w: { name: string; sub?: string; group?: string }) => !q || `${w.name} ${w.sub || ''} ${w.group || ''}`.toLowerCase().includes(q);
  let ws = LISTED.filter(matches);
  if (p.filter) ws = ws.filter((w) => p.status[w.id] === p.filter);
  if (p.sort === 'near') ws.sort((a, b) => ((p.dist[a.id] ?? 1e9) - (p.dist[b.id] ?? 1e9)) || byName(a, b));
  else if (p.sort === 'status') ws.sort((a, b) => STATUS_ORDER[p.status[a.id]] - STATUS_ORDER[p.status[b.id]] || byName(a, b));
  else ws.sort(byName);
  const selW = p.sel ? WATER_BY_ID.get(p.sel) : undefined;
  const card = (w: (typeof WATERS)[number]) => (
    <WaterCard key={w.id} w={w} date={p.date} sp={p.sp} status={p.status[w.id]} selected={p.sel === w.id} dist={p.sort === 'near' ? p.dist[w.id] : undefined} flow={GAUGES[w.id] ? p.flows[GAUGES[w.id].stn] : undefined} noticeDate={noticesFor(p.notices, w.id)[0]?.date} onSelect={() => p.onSelect(w.id)} />
  );

  return (
    <aside className="panel" ref={ref}>
      <div className="summary">
        {SUMMARY.map(([k, label]) => (
          <button key={k} className={k} aria-pressed={p.filter === k} onClick={() => p.onFilter(p.filter === k ? null : k)}>
            <span className="n">{counts[k]}</span><span className="t">{label}</span>
          </button>
        ))}
      </div>
      <div className="legend-m" aria-hidden="true">{LEGEND.map(([k, l]) => <span key={k} className={k}><i />{l}</span>)}</div>
      <div className="scroll" ref={scrollRef}>
        {selW ? (
          <WaterDetail w={selW} date={p.date} status={p.status[selW.id]} wg={p.wg} notices={[...noticesFor(p.notices, selW.id), ...regionNotices(p.notices)]} onBack={p.onBack} onZoom={() => p.onZoom(selW.id)} />
        ) : (
          <>
            <div className={`tools${p.sort === 'near' ? ' near' : ''}`}>
              <input type="search" id="q" placeholder="Find a river…" aria-label="Find a river" value={p.q} onChange={(e) => p.onQ(e.target.value)} />
              <select id="sort" aria-label="Sort" value={p.sort} onChange={(e) => p.onSort(e.target.value as SortMode)}>
                <option value="status">Sort: status</option>
                <option value="name">Sort: name</option>
                <option value="near">Sort: nearest to…</option>
              </select>
              {p.sort === 'near' && (
                <select id="near" className="grow" aria-label="Nearest to" value={p.near} onChange={(e) => { if (e.target.value === 'me') p.onLocate(); else p.onNear(e.target.value); }}>
                  <option value="me">{p.hasUserLoc ? 'My location' : 'My location (allow access)'}</option>
                  {CITIES.filter((c) => c[3] <= 2).map((c) => c[0]).sort().map((n) => <option key={n} value={n}>{n}</option>)}
                </select>
              )}
            </div>
            <Notices notices={p.notices} fetchedAt={p.noticesFetchedAt} onSelect={p.onSelect} />
            <ChangingSoon date={p.date} onSelect={p.onSelect} />
            <ul className="list">
              {ws.length === 0 && <li className="muted" style={{ padding: '8px 2px' }}>Nothing matches.</li>}
              {ws.map(card)}
            </ul>
            <label className="toggle-un"><input type="checkbox" checked={p.showUn} onChange={(e) => p.onShowUn(e.target.checked)} /> Show rivers with no salmon opportunity</label>
            {p.showUn && <ul className="list">{UNLISTED.filter(matches).map(card)}</ul>}
            <details className="global">
              <summary>Rules that apply everywhere in Region 2</summary>
              <ul>{GLOBAL_RULES.map((r) => <li key={r}>{r}</li>)}</ul>
            </details>
          </>
        )}
      </div>
      <div className={`foot${footOpen ? ' open' : ''}`}>
        Not an official source: confirm with the <a href={SOURCE_URL} target="_blank" rel="noopener">DFO page</a>, fishery notices and on-site signs before you fish.{' '}
        <span className="long">Rules from the DFO Region 2 freshwater salmon page (modified {SOURCE_DATE}). River lines, lakes, roads: BC Freshwater Atlas and Digital Road Atlas (Open Government Licence – BC).
        Boundary points are placed from the written descriptions; those marked approximate were estimated. River data: Environment and Climate Change Canada (provisional).{p.dfoCheckedAt && <> DFO page last checked {p.dfoCheckedAt.slice(0, 10)}.</>}</span>
        <button className="more" onClick={() => setFootOpen((o) => !o)} aria-expanded={footOpen}>{footOpen ? 'Less' : 'Sources & disclaimer'}</button>
        {' · '}<a href="https://github.com/AlexAksn/salmon-waters/issues" target="_blank" rel="noopener">Report a problem</a>
      </div>
    </aside>
  );
});
export default Panel;
