import { useMemo } from 'react';
import { useRegion } from '../lib/region';
import { fmtDate, SPN, STATUS_LABEL, upcoming } from '../lib/rules';

export default function ChangingSoon({ date, onSelect }: { date: Date; onSelect: (id: string) => void }) {
  const { waters } = useRegion();
  const ev = useMemo(() => upcoming(date, 45, waters), [date, waters]);
  return (
    <details className="soon" open>
      <summary><span>Changing soon</span><small>{ev.length ? `next 45 days · from ${fmtDate(date)}` : 'nothing in the next 45 days'}</small></summary>
      <ul>
        {ev.slice(0, 14).map((e, i) => (
          <li key={i}>
            <span className="d">{fmtDate(e.d)}</span>
            <span>
              <b onClick={() => onSelect(e.w.id)}>{e.w.name}{e.w.sub && <span className="muted"> · {e.w.sub}</span>}</b><br />
              {e.ch.map((c, j) => c.kind === 'gear'
                ? <span key={j} className="ev gear">{c.to ? `${c.to} starts` : `${c.from} ends`}</span>
                : <span key={j}><span className={`ev ${c.to}`}>{SPN[c.sp]}: {STATUS_LABEL[c.to].toLowerCase()}</span>{c.limit && <span className="muted">{c.limit}</span>}</span>)}
            </span>
          </li>
        ))}
      </ul>
    </details>
  );
}
