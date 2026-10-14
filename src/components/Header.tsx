import { isoLocal, parseIso, type SpeciesPick } from '../lib/rules';

interface Props { date: Date; sp: SpeciesPick; onDate: (d: Date) => void; onShift: (n: number) => void; onToday: () => void; onSp: (s: SpeciesPick) => void }
const SPECIES: [SpeciesPick, string][] = [['any', 'Any salmon'], ['chinook', 'Chinook'], ['coho', 'Coho']];

export default function Header({ date, sp, onDate, onShift, onToday, onSp }: Props) {
  return (
    <header className="top">
      <div className="brand"><h1>Salmon Waters</h1><span>Lower Mainland · DFO Region 2</span></div>
      <div className="datebar" role="group" aria-label="Date">
        <button className="ibtn" onClick={() => onShift(-1)} aria-label="Previous day" title="Previous day">‹</button>
        <input type="date" id="date" aria-label="Date" value={isoLocal(date)} onChange={(e) => { const d = parseIso(e.target.value); if (d) onDate(d); }} />
        <button className="ibtn" onClick={() => onShift(1)} aria-label="Next day" title="Next day">›</button>
        <button className="tbtn" onClick={onToday}>Today</button>
      </div>
      <div className="chips" role="group" aria-label="Species">
        <span className="lab">I want</span>
        {SPECIES.map(([id, label]) => (
          <button key={id} className="chip" aria-pressed={sp === id} onClick={() => onSp(id)}>{label}</button>
        ))}
      </div>
    </header>
  );
}
