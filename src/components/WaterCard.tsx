import type { Water } from '../data/regs';
import { ruleLine, SPN, STATUS_LABEL, type SpeciesPick, type Status } from '../lib/rules';
import SeasonStrip from './SeasonStrip';
import FlowChip from './FlowChip';
import type { Reading } from '../lib/flow';

interface Props { w: Water; date: Date; sp: SpeciesPick; status: Status; selected: boolean; dist?: number; flow?: Reading[]; onSelect: () => void }

export default function WaterCard({ w, date, sp, status, selected, dist, flow, onSelect }: Props) {
  const rl = ruleLine(w, date, sp);
  const key = (e: React.KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(); } };
  return (
    <li className={`card ${status}${selected ? ' sel' : ''}`} tabIndex={0} role="button" aria-label={w.name} onClick={onSelect} onKeyDown={key}>
      <div className="h">
        <div><div className="nm">{w.name}</div>{w.sub && <div className="sb">{w.sub}</div>}</div>
        <div className="right"><span className={`pill ${status}`}>{STATUS_LABEL[status]}</span>{dist != null && <span className="dist">~{Math.round(dist)} km</span>}</div>
      </div>
      {w.kind === 'tidal' ? (
        <div className="h"><div className="rule muted">Managed under tidal (Area 29) rules</div><FlowChip rs={flow} /></div>
      ) : (
        <>
          <div className="rule">
            {rl.closed ? <b>{rl.closed}</b> : rl.parts.length === 0 ? <span className="muted">No salmon opportunity today</span>
              : rl.parts.map((p, i) => <span key={p.sp}>{i > 0 && ' · '}<b>{SPN[p.sp]}</b> {p.text}</span>)}
          </div>
          {(rl.gear.length > 0 || flow) && <div className="h"><div>{rl.gear.map((g) => <span key={g} className="gear">{g}</span>)}</div><FlowChip rs={flow} /></div>}
          <SeasonStrip w={w} date={date} />
        </>
      )}
    </li>
  );
}
