import { useEffect, useState } from 'react';
import type { Water } from '../regions/model';
import { useRegion } from '../lib/region';
import type { WatersGeo } from '../lib/geo';
import { active, dayFish, daySummary, FISH, fmtDate, fmtMD, KIND_STATUS, sameDay, SPN, STATUS_LABEL, type SpeciesPick, type Status } from '../lib/rules';
import { shareWater, type ShareMode } from '../lib/share';
import FlowPanel from './FlowPanel';
import { fmtNoticeDate, NOTICE_DAYS, type Notice } from '../lib/notices';
import SeasonStrip from './SeasonStrip';
import Star from './Star';

interface Props { w: Water; date: Date; sp: SpeciesPick; status: Status; wg: WatersGeo; notices: Notice[]; fav: boolean; onFav: () => void; onBack: () => void; onZoom: () => void }


function nearMarks(w: Water, wg: WatersGeo) {
  const segs = wg.geo[w.id]; if (!segs?.length) return [];
  let minx = 1e9, miny = 1e9, maxx = -1e9, maxy = -1e9;
  segs.forEach((s) => s.forEach(([x, y]) => { minx = Math.min(minx, x); maxx = Math.max(maxx, x); miny = Math.min(miny, y); maxy = Math.max(maxy, y); }));
  const px = (maxx - minx) * 0.02 + 0.002, py = (maxy - miny) * 0.02 + 0.002;
  return wg.marks.filter((m) => m.k !== 'i' && m.c[0] >= minx - px && m.c[0] <= maxx + px && m.c[1] >= miny - py && m.c[1] <= maxy + py);
}
export default function WaterDetail({ w, date, sp, status, wg, notices, fav, onFav, onBack, onZoom }: Props) {
  const region = useRegion();
  const day = w.elsewhere ? null : daySummary(w, date);
  const marks = nearMarks(w, wg);
  const notice = (id?: string) => (id ? <> <a href={region.notices[id]} target="_blank" rel="noopener">{id}</a></> : null);
  // One "catch and release for all salmon" rule and nothing to keep: say it once instead of five times.
  const allNr = !!day && !day.closed && FISH.every((f) => !day.fish[f].keep.length && day.fish[f].nr.some((r) => r.sp === 'all'));
  return (
    <div className="detail">
      <button className="back" onClick={onBack}>‹ All waters</button>
      <div className="h2row"><div><h2>{w.name}</h2>{w.sub && <div className="sub">{w.sub}</div>}</div><Star on={fav} onToggle={onFav} big /></div>
      <div className={`status-box ${status}`}>
        <div className="big">{STATUS_LABEL[status]} · {fmtDate(date)}{sameDay(date, new Date()) && ' (today)'}</div>
        {w.elsewhere ? (
          <>
            <div>{w.elsewhere.text}</div>
            {w.elsewhere.link && <div><a href={w.elsewhere.link} target="_blank" rel="noopener">Open Area 29 tidal regulations</a></div>}
          </>
        ) : day && (
          <>
            {day.closed && <div>{day.closed.limit || 'No fishing for salmon'}</div>}
            <ul>
              {allNr && <li><b>All salmon:</b> catch & release only (non-retention)</li>}
              {!day.closed && !allNr && dayFish(w, day).map((f) => {
                const { keep, nr } = day.fish[f];
                return <li key={f}><b>{SPN[f]}:</b> {keep.length ? keep.map((r, i) => <span key={i}>{i > 0 && '; '}{r.limit}{notice(r.notice)}</span>) : nr.length ? 'catch & release only (non-retention)' : 'no opportunity today'}</li>;
              })}
              {!day.closed && !allNr && dayFish(w, day).length < FISH.length && <li className="muted">Other salmon: no opportunity listed</li>}
              {day.gear.map((r, i) => <li key={`g${i}`}><b>Gear:</b> {r.limit}</li>)}
              <li>{region.dayNote}</li>
            </ul>
          </>
        )}
      </div>
      {notices.length > 0 && (
        <div className="notices">
          <div className="sect-t">Fishery notices · last {NOTICE_DAYS} days</div>
          <ul className="marks">{notices.map((n) => <li key={n.fn}><span className="d">{fmtNoticeDate(n.date)}</span> <a href={n.url} target="_blank" rel="noopener">{n.fn}</a> {n.subject}{n.waters.length === 0 && <span className="muted"> (region-wide)</span>}</li>)}</ul>
          <div className="muted small">Notices can change the rules below before the DFO page is updated. Read them before you go.</div>
        </div>
      )}
      {day && <SeasonStrip w={w} date={date} />}
      {region.gauges[w.id] && <FlowPanel gauge={region.gauges[w.id]} />}
      {w.area && <dl className="kv"><dt>Where</dt><dd>{w.area}</dd>{w.group && <><dt>Group</dt><dd>{w.group}</dd></>}</dl>}
      {w.notes?.length ? <ul className="marks">{w.notes.map((n) => <li key={n}>{n}</li>)}</ul> : null}
      {w.rules.length > 0 && (
        <>
          <div className="sect-t">All season windows</div>
          <table className="win">
            <thead><tr><th>Species</th><th>Dates</th><th>Rule</th></tr></thead>
            <tbody>
              {w.rules.map((r, i) => (
                <tr key={i} className={active(r, date) ? 'act' : ''}>
                  <td><span className={`dot ${KIND_STATUS[r.kind]}`} />{SPN[r.sp]}</td>
                  <td className="d">{fmtMD(r.from)} – {r.to ? fmtMD(r.to) : 'further notice'}</td>
                  <td>{r.kind === 'nr' ? 'Non-retention (catch & release)' : r.limit}{notice(r.notice)}</td>
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
        <ShareButton mode="link" idle="Share link" share={() => shareWater({ w, date, sp, status, region, url: location.href }, 'link')} />
        <ShareButton mode="card" idle="Share card" share={() => shareWater({ w, date, sp, status, region, url: location.href }, 'card')} />
        <a className="btn" href={region.dfo.url} target="_blank" rel="noopener">DFO source page</a>
      </div>
    </div>
  );
}

const DONE: Record<Awaited<ReturnType<typeof shareWater>>, string> = { shared: 'Shared', copied: 'Link copied', saved: 'Image saved', cancelled: '', failed: 'Could not share' };
/** One share action with its own "done" label for a few seconds. */
function ShareButton({ mode, idle, share }: { mode: ShareMode; idle: string; share: () => ReturnType<typeof shareWater> }) {
  const [label, setLabel] = useState(idle);
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (label === idle) return; const t = setTimeout(() => setLabel(idle), 3000); return () => clearTimeout(t); }, [label, idle]);
  const go = async () => { setBusy(true); try { const r = await share(); setLabel(DONE[r] || idle); } finally { setBusy(false); } };
  return <button className="btn" data-share={mode} onClick={go} disabled={busy} aria-live="polite">{busy && mode === 'card' ? 'Preparing…' : label}</button>;
}
