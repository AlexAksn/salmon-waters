import type { Water } from '../regions/model';
import { dayOfYear, MON, seasonRuns, SPECIES_ABBR, STATUS_LABEL, waterFish, type Fish } from '../lib/rules';

export default function SeasonStrip({ w, date }: { w: Water; date: Date }) {
  const year = date.getFullYear();
  const doy = dayOfYear(date);
  const fish = waterFish(w);
  const rows: Fish[] = fish.length ? fish : ['chinook', 'coho']; // closure-only waters still get the two usual rows
  const row = (sp: Fish) => (
    <span key={sp} style={{ display: 'contents' }}>
      <span className="sp">{SPECIES_ABBR[sp]}</span>
      <div className="bar">
        {seasonRuns(w, sp, year).filter((r) => r.st !== 'none' && r.st !== 'tidal').map((r) => (
          <i key={r.start} className={r.st} style={{ left: `${(r.start / 365) * 100}%`, width: `${(r.n / 365) * 100}%` }} title={STATUS_LABEL[r.st]} />
        ))}
      </div>
    </span>
  );
  return (
    <div className="strip-wrap">
      <div className="strip">
        {rows.map(row)}
        <div className="months">{MON.map((m) => <span key={m}>{m[0]}</span>)}</div>
      </div>
      <div className="nowline" style={{ left: `calc(${((doy / 365) * 100).toFixed(2)}% - ${((doy / 365) * 28).toFixed(1)}px)` }} />
    </div>
  );
}
