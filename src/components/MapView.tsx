import { useEffect, useRef, type MutableRefObject } from 'react';
import { BASEMAPS, type Basemap } from '../lib/basemaps';
import type { BaseData, WatersGeo } from '../lib/geo';
import { SalmonMap } from '../lib/map';
import { useRegion } from '../lib/region';
import { fmtDate, sameDay, STATUS_LABEL, type Status } from '../lib/rules';

interface Props {
  data: { base: BaseData; wg: WatersGeo }; status: Record<string, Status>; filter: Status | null; sel: string | null; base: Basemap; date: Date;
  mapRef: MutableRefObject<SalmonMap | null>; onSelect: (id: string) => void; onBase: (b: Basemap) => void; onLocate: () => void;
}

export default function MapView({ data, status, filter, sel, base, date, mapRef, onSelect, onBase, onLocate }: Props) {
  const region = useRegion();
  const el = useRef<HTMLDivElement>(null);
  const live = useRef({ status, onSelect });
  live.current = { status, onSelect };
  const initialSel = useRef(sel);

  useEffect(() => {
    if (!el.current) return;
    const m = new SalmonMap(el.current, data.base, data.wg, region.waters, region.cities, {
      home: region.home,
      onSelect: (id) => live.current.onSelect(id),
      tooltip: (id) => { const w = region.byId.get(id)!; return `${w.name}${w.sub ? ` · ${w.sub}` : ''}<br><span style="opacity:.8">${STATUS_LABEL[live.current.status[id]]}</span>`; },
    });
    mapRef.current = m;
    if (import.meta.env.DEV) (window as unknown as { __salmonMap?: SalmonMap }).__salmonMap = m; // for UI tests only
    if (initialSel.current) m.zoomTo(initialSel.current, false); // deep link: jump, don't animate
    const ro = new ResizeObserver(() => m.invalidate());
    ro.observe(el.current);
    return () => { ro.disconnect(); m.destroy(); mapRef.current = null; };
  }, [data, region, mapRef]);
  useEffect(() => { mapRef.current?.paint(status, filter, sel); }, [status, filter, sel, mapRef]);
  useEffect(() => { mapRef.current?.setBasemap(base); }, [base, mapRef]);

  return (
    <div className="mapwrap">
      <div className="map" ref={el} />
      {!sel && <div className="hint">Tap a river for {sameDay(date, new Date()) ? 'today’s' : `${fmtDate(date)}’s`} rules</div>}
      <div className="bm" role="group" aria-label="Basemap">
        {BASEMAPS.map((b) => <button key={b.id} aria-pressed={base === b.id} onClick={() => onBase(b.id)}>{b.label}</button>)}
      </div>
      <button className="locate" title="Use my location" aria-label="Use my location" onClick={onLocate}>◎</button>
      <div className="legend" aria-hidden="true">
        <div><i className="open" />Open · you can keep fish</div>
        <div><i className="cr" />Catch &amp; release only</div>
        <div><i className="closed" />Closed to salmon</div>
        <div><i className="none" />No salmon opportunity listed</div>
        <div><i className="tidal" />Tidal water · other rules</div>
        <div><span className="mk" />Regulation boundary</div>
      </div>
    </div>
  );
}
