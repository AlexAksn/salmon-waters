import { useEffect, useMemo, useRef, useState } from 'react';
import { type Gauge, wateroffice } from '../data/gauges';
import { ageMinutes, fetchHistory, fetchTypical, fmtQ, fmtReading, hasFlow, latest, metric, trend, vsTypical, type Reading, type Typical } from '../lib/flow';
import { MON } from '../lib/rules';

const HOURS = 72;
const W = 360, H = 120, PL = 8, PR = 10, PT = 10, PB = 20;

/** River conditions for the detail view: current reading, trend, 72 h chart, and "normal for this month". */
export default function FlowPanel({ gauge }: { gauge: Gauge }) {
  const [rs, setRs] = useState<Reading[] | null>(null);
  const [typ, setTyp] = useState<Typical | null>(null);
  const [err, setErr] = useState(false);
  const [hover, setHover] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const month = new Date().getMonth() + 1;

  useEffect(() => {
    let live = true; setRs(null); setTyp(null); setErr(false);
    fetchHistory(gauge.stn, HOURS).then((r) => { if (live) setRs(r); }).catch(() => { if (live) setErr(true); });
    fetchTypical(gauge.stn, month).then((t) => { if (live) setTyp(t); }).catch(() => { /* optional context */ });
    return () => { live = false; };
  }, [gauge.stn, month]);

  const now = rs ? latest(rs) : null;
  const tr = rs ? trend(rs) : null;
  const flow = !!rs && hasFlow(rs);
  const cmp = now && now.q != null && typ ? vsTypical(now.q, typ) : null;

  const chart = useMemo(() => {
    if (!rs || rs.length < 2) return null;
    const vals = rs.map(metric).filter((v): v is number => v != null);
    let lo = Math.min(...vals), hi = Math.max(...vals);
    // Draw the "typical" reference inside the plot only when it is within 2x of the series; otherwise annotate off-axis.
    const typIn = flow && typ?.meanQ != null && typ.meanQ <= hi * 2 && typ.meanQ >= lo / 2;
    if (typIn && typ?.meanQ != null) { lo = Math.min(lo, typ.meanQ); hi = Math.max(hi, typ.meanQ); }
    if (hi - lo < 1e-9) { hi = lo + 1; }
    const pad = (hi - lo) * 0.08; lo = Math.max(0, lo - pad); hi += pad;
    const t0 = rs[0].t, t1 = rs[rs.length - 1].t || t0 + 1;
    const x = (t: number) => PL + ((t - t0) / (t1 - t0 || 1)) * (W - PL - PR);
    const y = (v: number) => PT + (1 - (v - lo) / (hi - lo)) * (H - PT - PB);
    const pts = rs.map((r) => { const v = metric(r); return v == null ? null : [x(r.t), y(v)] as const; }).filter((p): p is readonly [number, number] => !!p);
    const line = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' ');
    const area = `${line} L${pts[pts.length - 1][0].toFixed(1)} ${(H - PB).toFixed(1)} L${pts[0][0].toFixed(1)} ${(H - PB).toFixed(1)} Z`;
    const days: { x: number; label: string }[] = [];
    for (let d = new Date(t0); d.getTime() <= t1; d.setDate(d.getDate() + 1)) { const m = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime(); if (m >= t0) days.push({ x: x(m), label: `${MON[new Date(m).getMonth()]} ${new Date(m).getDate()}` }); }
    return { lo, hi, x, y, pts, line, area, days, t0, t1, typIn };
  }, [rs, typ, flow]);

  const onMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (!chart || !svgRef.current || !rs) return;
    const rect = svgRef.current.getBoundingClientRect();
    const cx = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const t = chart.t0 + ((cx - rect.left) / rect.width * W - PL) / (W - PL - PR) * (chart.t1 - chart.t0);
    let best = 0; for (let i = 1; i < rs.length; i++) if (Math.abs(rs[i].t - t) < Math.abs(rs[best].t - t)) best = i;
    setHover(best);
  };
  const hv = hover != null && rs ? rs[hover] : null;
  const typLine = chart && chart.typIn && typ?.meanQ != null ? chart.y(typ.meanQ) : null;
  const typOff = chart && !chart.typIn && flow && typ?.meanQ != null ? (typ.meanQ > chart.hi ? 'above' : 'below') : null;
  const fmtT = (t: number) => new Date(t).toLocaleString(undefined, { weekday: 'short', hour: 'numeric', minute: '2-digit' });

  return (
    <section className="flowpanel">
      <div className="sect-t">River conditions · {gauge.name}</div>
      {err && <div className="muted">Gauge data unavailable right now. <a href={wateroffice(gauge.stn)} target="_blank" rel="noopener">Open Water Office</a></div>}
      {!err && !rs && <div className="muted">Loading gauge…</div>}
      {rs && now && (
        <>
          <div className="flowhead">
            <div className="big">{fmtReading(now)}</div>
            <div className="meta">
              {tr && <span className={`tr ${tr.dir}`}>{tr.dir === 'rising' ? '▲' : tr.dir === 'falling' ? '▼' : '▶'} {tr.dir}{tr.pct24h != null && ` · ${tr.pct24h > 0 ? '+' : ''}${tr.pct24h.toFixed(0)} % in 24 h`}</span>}
              {cmp && typ && <span className={`norm ${cmp.cls}`}>{cmp.cls === 'low' ? 'Low' : cmp.cls === 'high' ? 'High' : 'Normal'} for {MON[typ.month - 1]} (typical ~{fmtQ(typ.meanQ!)} m³/s)</span>}
              <span className="muted">{ageMinutes(now) < 90 ? `${ageMinutes(now)} min ago` : `${Math.round(ageMinutes(now) / 60)} h ago`}{!flow && ' · level only'}</span>
            </div>
          </div>
          {chart && (
            <div className="chartwrap">
              <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} className="flowchart" role="img" aria-label={`${HOURS} hour ${flow ? 'discharge' : 'level'} chart`}
                onMouseMove={onMove} onMouseLeave={() => setHover(null)} onTouchMove={onMove} onTouchEnd={() => setHover(null)}>
                <line className="grid" x1={PL} x2={W - PR} y1={PT} y2={PT} /><line className="grid" x1={PL} x2={W - PR} y1={H - PB} y2={H - PB} />
                {chart.days.map((d) => <g key={d.x}><line className="grid" x1={d.x} x2={d.x} y1={PT} y2={H - PB} /><text className="ax" x={d.x + 3} y={H - 6}>{d.label}</text></g>)}
                {typLine != null && (
                  <g>
                    <line className="typ" x1={PL} x2={W - PR} y1={typLine} y2={typLine} />
                    <text className="ax" x={W - PR} y={typLine - 3} textAnchor="end">{`typical ${MON[month - 1]}`}</text>
                  </g>
                )}
                <path className="area" d={chart.area} /><path className="line" d={chart.line} />
                <text className="ax" x={PL} y={PT - 2}>{flow ? `${fmtQ(chart.hi)} m³/s` : `${chart.hi.toFixed(2)} m`}</text>
                {typOff && typ?.meanQ != null && <text className="ax" x={W - PR} y={typOff === 'above' ? PT - 2 : H - PB - 3} textAnchor="end">{`typical ${MON[month - 1]} ~${fmtQ(typ.meanQ)} ${typOff === 'above' ? '↑' : '↓'}`}</text>}
                {(() => { const p = chart.pts[chart.pts.length - 1]; return <circle className="end" cx={p[0]} cy={p[1]} r="4" />; })()}
                {hv && metric(hv) != null && (
                  <g><line className="cross" x1={chart.x(hv.t)} x2={chart.x(hv.t)} y1={PT} y2={H - PB} /><circle className="hov" cx={chart.x(hv.t)} cy={chart.y(metric(hv)!)} r="4" /></g>
                )}
              </svg>
              <div className="tip" aria-live="polite">{hv ? `${fmtT(hv.t)} · ${fmtReading(hv)}` : `Last ${HOURS} h · hover for values`}</div>
            </div>
          )}
          <details className="tbl"><summary>Table (6-hourly)</summary>
            <table className="win"><thead><tr><th>Time</th><th>{flow ? 'Discharge' : 'Level'}</th></tr></thead>
              <tbody>{rs.filter((_, i) => i % 72 === 0 || i === rs.length - 1).map((r) => <tr key={r.t}><td className="d">{fmtT(r.t)}</td><td>{fmtReading(r)}</td></tr>)}</tbody></table>
          </details>
          <div className="muted small">{gauge.note && <>{gauge.note} </>}Source: Environment and Climate Change Canada, station {gauge.stn} (<a href={wateroffice(gauge.stn)} target="_blank" rel="noopener">Water Office</a>). Provisional data.</div>
        </>
      )}
    </section>
  );
}
