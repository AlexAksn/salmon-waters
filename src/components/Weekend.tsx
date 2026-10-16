import { useMemo } from 'react';
import { useRegion } from '../lib/region';
import { shareWeekend } from '../lib/share';
import { fmtRange, weekendSummary } from '../lib/weekend';
import ShareButton from './ShareButton';

/** One line about the coming weekend and a button that shares it as a card (what the groups get on Thursdays). */
export default function Weekend({ date }: { date: Date }) {
  const region = useRegion();
  const s = useMemo(() => weekendSummary(region.waters, date), [region, date]);
  const n = s.events.length;
  return (
    <div className="weekend">
      <span><b>Weekend {fmtRange(s.sat, s.sun)}</b> · <span className="open">{s.counts.open} open</span> · {n ? `${n} change${n === 1 ? '' : 's'}` : 'no changes'}</span>
      <ShareButton id="weekend" idle="Share card" busyLabel="Preparing…" share={() => shareWeekend({ region, date, summary: s })} />
    </div>
  );
}
