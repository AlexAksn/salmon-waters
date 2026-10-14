import { NOTICES, SOURCE_URL } from '../data/regs';
import type { WatersGeo } from '../lib/geo';
import { active, activeRules, fmtDate, fmtMD, isUnlisted, sameDay, SPN, STATUS_LABEL, type AnyWater, type Status } from '../lib/rules';
import SeasonStrip from './SeasonStrip';
import FlowPanel from './FlowPanel';
import { GAUGES } from '../data/gauges';

interface Props { w: AnyWater; date: Date; status: Status; wg: WatersGeo; onBack: () => void; onZoom: () => void }

function nearMarks(w: AnyWater, wg: WatersGeo) {
  const segs = wg.geo[w.id]; if (!segs?.length) return [];
  let minx = 1e9, miny = 1e9, maxx = -1e9, maxy = -1e9;
  segs.forEach((s) => s.forEach(([x, y]) => { minx = Math.min(minx, x); maxx = Math.max(maxx, x); miny = Math.min(miny, y); maxy = Math.max(maxy, y); }));
  const px = (maxx - minx) * 0.02 + 0.002, py = (maxy - miny) * 0.02 + 0.002;
  return wg.marks.filter((m) => m.k !== 'i' && m.c[0] >= minx - px && m.c[0] <= maxx + px && m.c[1] >= miny - py && m.c[1] <= maxy + py);
}
const Notice = ({ id }: { id?: string }) => (id ? <> <a href={NOTICES[id]} target="_blank" rel="noopener">{id}</a></> : null);

export default function WaterDetail({ w, date, status, wg, onBack, onZoom }: Props) {
  const un = isUnlisted(w);
  const act = activeRules(w, date);
  const closed = act.find((r) => r.kind === 'closed');
  const marks = nearMarks(w, wg);
  return (
    <div className="detail">
      <button className="back" onClick={onBack}>‹ All waters</button>
      <div><h2>{w.name}</h2>{!un && w.sub && <div className="sub">{w.sub}</div>}</div>
      <div className={`status-box ${status}`}>
        <div className="big">{STATUS_LABEL[status]} · {fmtDate(date)}{sameDay(date, new Date()) && ' (today)'}</div>
        {un ? (
          <>
            <div>{w.zone === 'a131516' ? 'Flows into Area 13, 15 or 16: the daily salmon limit is 0 unless the water is listed. It is not listed.' : 'Flows into Area 28 or 29: there is no salmon fishing except in listed waters. This water is not listed.'}</div>
            {w.note && <div className="muted">{w.note}</div>}
          </>
        ) : w.kind === 'tidal' ? (
          <>
            <div>This stretch is tidal water. Salmon rules come from the Area 29 tidal regulations.</div>
            {w.link && <div><a href={w.link} target="_blank" rel="noopener">Open Area 29 tidal regulations</a></div>}
          </>
        ) : (
          <>
            {closed && <div>{closed.limit || 'No fishing for salmon'}</div>}
            <ul>
              {!closed && (['chinook', 'coho'] as const).map((s) => {
                const keep = act.filter((r) => r.sp === s && r.kind === 'keep'), nr = act.filter((r) => r.sp === s && r.kind === 'nr');
                return <li key={s}><b>{SPN[s]}:</b> {keep.length ? keep.map((r, i) => <span key={i}>{i > 0 && '; '}{r.limit}<Notice id={r.notice} /></span>) : nr.length ? 'catch & release only (non-retention)' : 'no opportunity today'}</li>;
              })}
              {act.filter((r) => r.kind === 'gear').map((r, i) => <li key={`g${i}`}><b>Gear:</b> {r.limit}</li>)}
              <li>Daylight hours only · 4 salmon/day all species combined</li>
            </ul>
          </>
        )}
      </div>
      {!un && w.kind !== 'tidal' && <SeasonStrip w={w} date={date} />}
      {GAUGES[w.id] && <FlowPanel gauge={GAUGES[w.id]} />}
      {!un && (
        <dl className="kv"><dt>Where</dt><dd>{w.area}</dd>{w.group && <><dt>Group</dt><dd>{w.group}</dd></>}</dl>
      )}
      {!un && w.notes?.length ? <ul className="marks">{w.notes.map((n) => <li key={n}>{n}</li>)}</ul> : null}
      {!un && w.rules.length > 0 && (
        <>
          <div className="sect-t">All season windows</div>
          <table className="win">
            <thead><tr><th>Species</th><th>Dates</th><th>Rule</th></tr></thead>
            <tbody>
              {w.rules.map((r, i) => (
                <tr key={i} className={active(r, date) ? 'act' : ''}>
                  <td><span className={`dot ${r.kind === 'keep' ? 'open' : r.kind === 'nr' ? 'cr' : r.kind === 'closed' ? 'closed' : 'gear'}`} />{SPN[r.sp]}</td>
                  <td className="d">{fmtMD(r.from)} – {r.to ? fmtMD(r.to) : 'further notice'}</td>
                  <td>{r.kind === 'nr' ? 'Non-retention (catch & release)' : r.limit}<Notice id={r.notice} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
      {marks.length > 0 && (
        <>
          <div className="sect-t">Boundary points on the map</div>
          <ul className="marks">{marks.map((m) => <li key={m.l}>{m.l}{m.a && <span className="muted"> (approximate)</span>}</li>)}</ul>
        </>
      )}
      <div className="actions">
        <button className="btn primary" onClick={onZoom}>Zoom to this water</button>
        <a className="btn" href={SOURCE_URL} target="_blank" rel="noopener">DFO source page</a>
      </div>
    </div>
  );
}
