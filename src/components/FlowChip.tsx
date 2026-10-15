import { fmtReading, latest, metric, metricRange, trend, TREND_ARROW, type Reading } from '../lib/flow';

/** Compact 24 h sparkline + current reading for a card. */
export default function FlowChip({ rs }: { rs: Reading[] | undefined }) {
  if (!rs?.length) return null;
  const now = latest(rs)!, tr = trend(rs), range = metricRange(rs);
  if (!range) return null;
  const span = range.max - range.min || 1;
  const W = 56, H = 14;
  const pts = rs.map((r, i) => { const v = metric(r); return v == null ? null : `${((i / (rs.length - 1 || 1)) * W).toFixed(1)},${(H - 1 - ((v - range.min) / span) * (H - 2)).toFixed(1)}`; }).filter(Boolean).join(' ');
  return (
    <span className="flow" title={`Last 24 h at the gauge · ${new Date(now.t).toLocaleString()}`}>
      <svg className="spark" width={W} height={H} viewBox={`0 0 ${W} ${H}`} aria-hidden="true"><polyline points={pts} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" /></svg>
      <span className="v">{fmtReading(now)}</span>
      {tr && <span className="tr">{TREND_ARROW[tr.dir]} {tr.dir}</span>}
    </span>
  );
}
