import { useRegion } from '../lib/region';
import { isoLocal, parseIso, type SpeciesPick, type SpeciesPickOption } from '../lib/rules';

interface Props { date: Date; sp: SpeciesPick; picks: SpeciesPickOption[]; onDate: (d: Date) => void; onShift: (n: number) => void; onToday: () => void; onSp: (s: SpeciesPick) => void }

export default function Header({ date, sp, picks, onDate, onShift, onToday, onSp }: Props) {
  const region = useRegion();
  return (
    <header className="top">
      <div className="brand"><h1>Salmon Waters</h1><span>{region.name} · DFO Region {region.num}</span></div>
      <div className="datebar" role="group" aria-label="Date">
        <button className="ibtn" onClick={() => onShift(-1)} aria-label="Previous day" title="Previous day">‹</button>
        <input type="date" id="date" aria-label="Date" value={isoLocal(date)} onChange={(e) => { const d = parseIso(e.target.value); if (d) onDate(d); }} />
        <button className="ibtn" onClick={() => onShift(1)} aria-label="Next day" title="Next day">›</button>
        <button className="tbtn" onClick={onToday}>Today</button>
      </div>
      <div className="chips" role="group" aria-label="Species">
        <span className="lab">I want</span>
        {picks.map((s) => <button key={s.id} className="chip" aria-pressed={sp === s.id} onClick={() => onSp(s.id)}>{s.label}</button>)}
      </div>
    </header>
  );
}
