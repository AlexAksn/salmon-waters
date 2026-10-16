import type { Water } from '../regions/model';
import { addDays, countStatuses, FISH, fmtDate, MON, SPN, statusOf, upcoming, type Change, type Counts, type Status, type UpcomingEvent } from './rules';

// "This weekend": the Saturday/Sunday on or after a date, what is open then, and every rule change between the date and Sunday.
export function weekendOf(d: Date): { sat: Date; sun: Date } {
  const dow = d.getDay();
  const sat = dow === 0 ? addDays(d, -1) : addDays(d, 6 - dow); // a Sunday belongs to the weekend that started yesterday
  return { sat, sun: addDays(sat, 1) };
}
export interface WeekendSummary { sat: Date; sun: Date; counts: Counts; events: UpcomingEvent[] }
export function weekendSummary(waters: Water[], date: Date): WeekendSummary {
  const { sat, sun } = weekendOf(date);
  const day = date > sat ? date : sat; // on the Sunday itself, count Sunday
  const days = Math.max(0, Math.round((sun.getTime() - date.getTime()) / 864e5));
  return { sat, sun, counts: countStatuses(waters, (w) => statusOf(w, day, 'any')), events: upcoming(date, days, waters) };
}
/** "Oct 17–18", "Oct 31–Nov 1". */
export const fmtRange = (a: Date, b: Date) => (a.getMonth() === b.getMonth() ? `${fmtDate(a)}–${b.getDate()}` : `${fmtDate(a)}–${MON[b.getMonth()]} ${b.getDate()}`);
const VERB: Record<Status, string> = { open: 'opens', cr: 'goes catch & release', closed: 'closes', none: 'ends', tidal: 'ends' };
/** "Chum opens, 2 per day" / "Coho closes" / "Bait ban starts". */
export const changeText = (c: Change) => (c.kind === 'gear' ? (c.to ? `${c.to} starts` : `${c.from} ends`) : `${SPN[c.sp]} ${VERB[c.to]}${c.limit && c.to === 'open' ? `, ${c.limit}` : ''}`);
/** Events that say the same thing on the same day, merged: one chum notice opening nine rivers reads as one line. */
export interface EventGroup { d: Date; text: string; names: string[]; /** status of the first change, for the colour bar */ color: Status | 'gear' }
export function groupEvents(events: UpcomingEvent[]): EventGroup[] {
  const out: EventGroup[] = [];
  for (const e of events) {
    // every species ending at once is the season closing, not five separate changes
    const allEnd = e.ch.length === FISH.length && e.ch.every((c) => c.kind === 'sp' && c.to === 'none');
    const text = allEnd ? 'Salmon season ends' : e.ch.map(changeText).join(', ');
    const g = out.find((x) => x.text === text && x.d.getTime() === e.d.getTime());
    if (g) { if (!g.names.includes(e.w.name)) g.names.push(e.w.name); } else out.push({ d: e.d, text, names: [e.w.name], color: e.ch[0].kind === 'sp' ? e.ch[0].to : 'gear' });
  }
  return out;
}
