import { useRegion } from '../lib/region';
import { fmtNoticeDate, NOTICE_DAYS, type Notice } from '../lib/notices';

interface Props { notices: Notice[]; fetchedAt: string | null; onSelect: (id: string) => void }

/** Recent DFO recreational-salmon notices for Region 2; these often land before the regulations page is edited. */
export default function Notices({ notices, fetchedAt, onSelect }: Props) {
  const { byId } = useRegion();
  return (
    <details className="soon" open={notices.length > 0}>
      <summary><span>Fishery notices</span><small>{`last ${NOTICE_DAYS} days`}{fetchedAt && ` · checked ${fmtNoticeDate(fetchedAt.slice(0, 10))}`}</small></summary>
      <ul>
        {notices.length === 0 && <li><span className="d" /><span className="muted">No recreational salmon notices for Region 2 lately.</span></li>}
        {notices.map((n) => (
          <li key={n.fn}>
            <span className="d">{fmtNoticeDate(n.date)}</span>
            <span>
              <a href={n.url} target="_blank" rel="noopener">{n.fn}</a> {n.subject}
              {n.waters.length > 0 && <><br />{n.waters.map((id) => byId.get(id)).filter(Boolean).map((w) => <button key={w!.id} className="ev notice" onClick={() => onSelect(w!.id)}>{w!.name}{w!.sub ? ` · ${w!.sub}` : ''}</button>)}</>}
            </span>
          </li>
        ))}
      </ul>
    </details>
  );
}
