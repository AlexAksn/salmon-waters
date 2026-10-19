import { useEffect, useMemo, useState } from 'react';
import { BC_REGIONS, isMapped, regionEntry, REGIONS, type RegionEntry, type RegionStub } from '../regions';
import type { RegionData } from '../regions/model';
import { getPosition } from '../lib/geo';
import { splitFav, toggleFav, useFavs } from '../lib/favs';
import { countStatuses, fmtDate, sameDay, STATUS_LABEL, statusOf, SUMMARY, type Counts } from '../lib/rules';
import { RuleText } from './WaterCard';
import Star from './Star';

/** public/data/bc-regions.json: one outline per DFO region (scripts/bc-regions.py), lon/lat rings. */
interface Outlines { regions: { num: number; rings: [number, number][][] }[] }
interface Props { date: Date; onPick: (id: string, water?: string) => void }

// Plate carrée scaled by cos(54.5°): plenty for a province-sized thumbnail. Units: 1/100 of a degree.
const LON0 = -139.2, LAT1 = 60.1, KX = Math.cos((54.5 * Math.PI) / 180) * 100, KY = 100;
const px = (c: [number, number]): [number, number] => [(c[0] - LON0) * KX, (LAT1 - c[1]) * KY];
const VIEWBOX = '0 0 1470 1198'; // BC under px(): x 8..1460, y 10..1188
const pathOf = (rings: [number, number][][]) => rings.map((r) => 'M' + r.map((c) => px(c).map((v) => v.toFixed(1)).join(' ')).join('L') + 'Z').join('');
/** Where each region's label sits (lon, lat), placed by hand so it reads inside the shape. */
const LABEL: Record<number, [number, number]> = { 1: [-126.61, 49.7], 2: [-123.6, 49.56], 3: [-120.1, 51.48], 4: [-116.82, 50.41], 5: [-124.35, 52.22], 6: [-130.06, 55.78], 7: [-123.44, 56.88], 8: [-119.35, 49.74] };
function inside([x, y]: [number, number], ring: [number, number][]) {
  let ins = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) ins = !ins;
  }
  return ins;
}
let outlinesP: Promise<Outlines> | undefined; // fetched and parsed once per page load, not per visit to the overview
const loadOutlines = () => (outlinesP ??= fetch(`${import.meta.env.BASE_URL}data/bc-regions.json`).then((r) => r.json() as Promise<Outlines>));

export default function Overview({ date, onPick }: Props) {
  const [outlines, setOutlines] = useState<Outlines | null>(null);
  const [loaded, setLoaded] = useState<Record<string, RegionData>>({});
  const [here, setHere] = useState<number | 'outside' | null>(null);
  const [locating, setLocating] = useState(false);
  const favs = useFavs();
  useEffect(() => { let live = true; loadOutlines().then((o) => { if (live) setOutlines(o); }).catch(() => { /* map stays blank; the list still works */ }); return () => { live = false; }; }, []);
  // Every mapped region's rules (small modules) for the counts and the starred rivers.
  useEffect(() => {
    let live = true;
    REGIONS.forEach((e) => e.load().then((d) => { if (live) setLoaded((prev) => ({ ...prev, [e.id]: d })); }));
    return () => { live = false; };
  }, []);
  const counts = useMemo(() => Object.fromEntries(Object.entries(loaded).map(([id, d]) => [id, countStatuses(d.waters, (w) => statusOf(w, date, 'any'))])) as Record<string, Counts>, [loaded, date]);
  const mine = favs.flatMap((key) => {
    const [rid, wid] = splitFav(key), r = regionEntry(rid), w = loaded[rid]?.byId.get(wid);
    return r && w ? [{ key, r, w, status: statusOf(w, date, 'any') }] : [];
  });
  const locate = () => {
    if (!outlines) return;
    setLocating(true);
    getPosition().then(([lat, lon]) => { const hit = outlines.regions.find((r) => r.rings.some((ring) => inside([lon, lat], ring))); setHere(hit ? hit.num : 'outside'); })
      .catch(() => { /* denied */ }).finally(() => setLocating(false));
  };
  const pick = (r: RegionEntry | RegionStub) => { if (isMapped(r)) onPick(r.id); };
  const hereRegion = typeof here === 'number' ? BC_REGIONS.find((r) => r.num === here) : undefined;
  const when = sameDay(date, new Date()) ? 'today' : `on ${fmtDate(date)}`;
  const line = (r: RegionEntry | RegionStub) => {
    if (!isMapped(r)) return <span className="muted">{r.note}</span>;
    const c = counts[r.id];
    return c ? <span className="cnt">{SUMMARY.map(([k, label], i) => <span key={k}>{i > 0 && ' · '}<b className={k}>{c[k]} {label}</b></span>)} {when}</span> : <span className="muted">Counting…</span>;
  };
  const cards = (rs: (RegionEntry | RegionStub)[], cls: string) => (
    <ul className={`list ov-list ${cls}`}>
      {rs.map((r) => (
        <li key={r.num} className={`card ${isMapped(r) ? 'on' : 'stub'}${here === r.num ? ' sel' : ''}`} onClick={() => pick(r)}>
          <div className="h"><div><div className="nm">{r.name}</div><div className="sb">DFO Region {r.num}{here === r.num && ' · you are here'}</div></div>
            {isMapped(r) ? <button className="btn primary">Open map</button> : <a className="btn" href={r.dfoUrl} target="_blank" rel="noopener">DFO page</a>}
          </div>
          <div className="rule">{line(r)}</div>
        </li>
      ))}
    </ul>
  );
  return (
    <div className="ov">
      <header className="top ov-top">
        <div className="brand"><h1>Salmon Waters</h1><span>BC freshwater salmon openings</span></div>
        <p className="tag">Pick a region. Two are mapped river by river; the rest show what DFO publishes and are next in line.</p>
      </header>
      <div className="ov-body">
        <div className="ov-side">
          {favs.length > 0 && (
            <div>
              <div className="sect-t">My rivers · {when}</div>
              <ul className="list">
                {mine.map(({ key, r, w, status }) => (
                  <li key={key} className={`card ${status}`} role="button" tabIndex={0} aria-label={w.name} onClick={() => onPick(r.id, w.id)} onKeyDown={(ev) => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); onPick(r.id, w.id); } }}>
                    <div className="h">
                      <div><div className="nm">{w.name}</div><div className="sb">{w.sub ? `${w.sub} · ` : ''}{r.name}</div></div>
                      <div className="right"><span className={`pill ${status}`}>{STATUS_LABEL[status]}</span></div>
                      <Star on onToggle={() => toggleFav(key)} />
                    </div>
                    <RuleText w={w} date={date} sp="any" />
                  </li>
                ))}
                {mine.length < favs.length && <li className="muted small">Loading…</li>}
              </ul>
            </div>
          )}
          {cards(BC_REGIONS.filter(isMapped), 'mapped')}
        </div>
        <div className="ov-map">
          <svg viewBox={VIEWBOX} role="img" aria-label="Map of BC fishing regions">
            {outlines && BC_REGIONS.map((r) => {
              const o = outlines.regions.find((x) => x.num === r.num);
              if (!o) return null;
              const mapped = isMapped(r), [lx, ly] = px(LABEL[r.num]);
              return (
                <g key={r.num} className={`reg${mapped ? ' on' : ''}${here === r.num ? ' here' : ''}`} onClick={() => pick(r)} role={mapped ? 'button' : undefined} tabIndex={mapped ? 0 : undefined} onKeyDown={(ev) => { if (ev.key === 'Enter' || ev.key === ' ') pick(r); }}>
                  <title>{`${r.name} · DFO Region ${r.num}${mapped ? '' : ' (not mapped yet)'}`}</title>
                  <path d={pathOf(o.rings)} />
                  <text x={lx} y={ly} textAnchor="middle"><tspan className="n">{r.num}</tspan><tspan x={lx} dy="1.25em">{r.name}</tspan></text>
                </g>
              );
            })}
          </svg>
          <div className="ov-tools">
            <button className="btn" onClick={locate} disabled={!outlines || locating}>{locating ? 'Locating…' : 'Where am I?'}</button>
            {here === 'outside' && <span className="muted">Outside BC, as far as the map can tell.</span>}
            {hereRegion && <span>You are in <b>{hereRegion.name}</b>{isMapped(hereRegion) ? <> · <button className="btn primary" onClick={() => onPick(hereRegion.id)}>Open map</button></> : <span className="muted"> (not mapped yet)</span>}</span>}
          </div>
        </div>
        {cards(BC_REGIONS.filter((r) => !isMapped(r)), 'stubs')}
      </div>
      <div className="foot">Not an official source: confirm with DFO, fishery notices and on-site signs before you fish. Region outlines: BC wildlife management units (Open Government Licence – BC). · <a href="https://github.com/AlexAksn/salmon-waters" target="_blank" rel="noopener">About / report a problem</a> · Free and ad-free, made in Vancouver. <a href="https://ko-fi.com/salmonwaters" target="_blank" rel="noopener">Buy me a coffee ☕</a></div>
    </div>
  );
}
