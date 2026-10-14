import { useEffect, useRef } from 'react';
import { CITIES, UNLISTED, WATERS } from '../data/regs';
import type { BaseData, WatersGeo } from '../lib/geo';
import { BASEMAPS, SalmonMap, type Basemap } from '../lib/map';
import { fmtDate, sameDay, STATUS_LABEL, statusOf, type SpeciesPick, type Status } from '../lib/rules';

interface Props {
  data: { base: BaseData; wg: WatersGeo }; status: Record<string, Status>; filter: Status | null; sel: string | null; base: Basemap; date: Date; sp: SpeciesPick;
  onReady: (m: SalmonMap) => void; onSelect: (id: string) => void; onBase: (b: Basemap) => void; onLocate: () => void;
}

export default function MapView({ data, status, filter, sel, base, date, sp, onReady, onSelect, onBase, onLocate }: Props) {
  const el = useRef<HTMLDivElement>(null);
  const mapRef = useRef<SalmonMap | null>(null);
  const live = useRef({ date, sp, onSelect });
  live.current = { date, sp, onSelect };

  useEffect(() => {
    if (!el.current) return;
    const byId = new Map([...WATERS, ...UNLISTED].map((w) => [w.id, w] as const));
    const m = new SalmonMap(el.current, data.base, data.wg, WATERS, UNLISTED, CITIES, {
      onSelect: (id) => live.current.onSelect(id),
      tooltip: (id) => {
        const w = byId.get(id)!;
        const sub = 'sub' in w && w.sub ? ` · ${w.sub}` : '';
        return `${w.name}${sub}<br><span style="opacity:.8">${STATUS_LABEL[statusOf(w, live.current.date, live.current.sp)]}</span>`;
      },
    });
    mapRef.current = m;
    onReady(m);
    const ro = new ResizeObserver(() => m.invalidate());
    ro.observe(el.current);
    return () => { ro.disconnect(); m.destroy(); mapRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);
  useEffect(() => { mapRef.current?.paint(status, filter, sel); }, [status, filter, sel]);
  useEffect(() => { mapRef.current?.setBasemap(base); }, [base]);

  return (
    <div className="mapwrap">
      <div className="map" ref={el} />
      {!sel && <div className="hint">Tap a river for {sameDay(date, new Date()) ? 'today’s' : `${fmtDate(date)}’s`} rules</div>}
      <div className="bm" role="group" aria-label="Basemap">
        {BASEMAPS.map((b) => <button key={b.id} aria-pressed={base === b.id} onClick={() => onBase(b.id)}>{b.label}</button>)}
      </div>
      <button className="locate" title="Use my location" aria-label="Use my location" onClick={onLocate}>◎</button>
      <div className="legend" aria-hidden="true">
        <div><i style={{ background: 'var(--open)' }} />Open · you can keep fish</div>
        <div><i style={{ background: 'var(--cr)' }} />Catch &amp; release only</div>
        <div><i style={{ background: 'var(--closed)' }} />Closed to salmon</div>
        <div><i style={{ background: 'var(--none)' }} />No salmon opportunity listed</div>
        <div><i style={{ background: 'var(--tidal)' }} />Tidal water · other rules</div>
        <div><span className="mk" />Regulation boundary</div>
      </div>
    </div>
  );
}
