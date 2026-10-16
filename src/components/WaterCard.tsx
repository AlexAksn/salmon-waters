import type { Water } from '../regions/model';
import type { Reading } from '../lib/flow';
import { ruleLine, SPN, STATUS_LABEL, type SpeciesPick, type Status } from '../lib/rules';
import { fmtNoticeDate } from '../lib/notices';
import FlowChip from './FlowChip';
import SeasonStrip from './SeasonStrip';

interface Props { w: Water; date: Date; sp: SpeciesPick; status: Status; selected: boolean; dist?: number; flow?: Reading[]; noticeDate?: string; onSelect: () => void }

export default function WaterCard({ w, date, sp, status, selected, dist, flow, noticeDate, onSelect }: Props) {
  const key = (e: React.KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(); } };
  const rl = w.elsewhere ? null : ruleLine(w, date, sp);
  return (
    <li className={`card ${status}${selected ? ' sel' : ''}`} tabIndex={0} role="button" aria-label={w.name} onClick={onSelect} onKeyDown={key}>
      <div className="h">
        <div><div className="nm">{w.name}</div>{w.sub && <div className="sb">{w.sub}</div>}</div>
        <div className="right"><span className={`pill ${status}`}>{STATUS_LABEL[status]}</span>{noticeDate && <span className="pill notice" title="A fishery notice mentions this water">Notice · {fmtNoticeDate(noticeDate)}</span>}{dist != null && <span className="dist">~{Math.round(dist)} km</span>}</div>
      </div>
      {rl ? (
        <div className="rule">
          {rl.closed ? <b>{rl.closed}</b> : rl.parts.length === 0 ? <span className="muted">No salmon opportunity today</span>
            : rl.parts.map((p, i) => <span key={p.sp}>{i > 0 && ' · '}<b>{SPN[p.sp]}</b> {p.text}</span>)}
        </div>
      ) : (
        <div className="rule muted">{w.elsewhere!.short}</div>
      )}
      {(rl?.gear.length || flow) && <div className="h"><div>{rl?.gear.map((g) => <span key={g} className="gear">{g}</span>)}</div><FlowChip rs={flow} /></div>}
      {rl && <SeasonStrip w={w} date={date} />}
    </li>
  );
}
