import { dayOfYear, MON, seasonRuns, STATUS_LABEL, type AnyWater } from '../lib/rules';

export default function SeasonStrip({ w, date }: { w: AnyWater; date: Date }) {
  const year = date.getFullYear();
  const doy = dayOfYear(date);
  const row = (sp: 'chinook' | 'coho') => (
    <>
      <span className="sp">{sp === 'chinook' ? 'CH' : 'CO'}</span>
      <div className="bar">
        {seasonRuns(w, sp, year).filter((r) => r.st !== 'none' && r.st !== 'tidal').map((r) => (
          <i key={r.start} className={r.st} style={{ left: `${(r.start / 365) * 100}%`, width: `${(r.n / 365) * 100}%` }} title={STATUS_LABEL[r.st]} />
        ))}
      </div>
    </>
  );
  return (
    <div className="strip-wrap">
      <div className="strip">
        {row('chinook')}{row('coho')}
        <div className="months">{MON.map((m) => <span key={m}>{m[0]}</span>)}</div>
      </div>
      <div className="nowline" style={{ left: `calc(${((doy / 365) * 100).toFixed(2)}% - ${((doy / 365) * 28).toFixed(1)}px)` }} />
    </div>
  );
}
