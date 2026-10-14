import { fmtReading, latest, metric, trend, type Reading } from '../lib/flow';

const ARROW = { rising: '▲', falling: '▼', steady: '▶' } as const;
const WORD = { rising: 'rising', falling: 'falling', steady: 'steady' } as const;

/** Compact 24 h sparkline + current reading for a card. */
export default function FlowChip({ rs }: { rs: Reading[] | undefined }) {
  if (!rs || !rs.length) return null;
  const now = latest(rs)!; const tr = trend(rs);
  const vals = rs.map(metric).filter((v): v is number => v != null);
  const min = Math.min(...vals), max = Math.max(...vals), span = max - min || 1;
  const W = 56, H = 14;
  const pts = rs.map((r, i) => { const v = metric(r); return v == null ? null : `${((i / (rs.length - 1 || 1)) * W).toFixed(1)},${(H - 1 - ((v - min) / span) * (H - 2)).toFixed(1)}`; }).filter(Boolean).join(' ');
  return (
    <span className="flow" title={`Last 24 h at the gauge · ${new Date(now.t).toLocaleString()}`}>
      <svg className="spark" width={W} height={H} viewBox={`0 0 ${W} ${H}`} aria-hidden="true"><polyline points={pts} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" /></svg>
      <span className="v">{fmtReading(now)}</span>
      {tr && <span className={`tr ${tr.dir}`}>{ARROW[tr.dir]} {WORD[tr.dir]}</span>}
    </span>
  );
}
