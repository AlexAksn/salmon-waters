import { addDays, fmtDate, isoLocal, parseIso } from './rules';

/** One DFO fishery notice, as produced by scripts/fetch-notices.mjs. */
export interface Notice { fn: string; docId: string; subject: string; date: string; sent: string; url: string; region: boolean; waters: string[] }
export interface NoticesFile { fetchedAt: string; ok: boolean; notices: Notice[] }

export const NOTICE_DAYS = 30;
/** Notices newer than `days` days (notices are kept sorted newest first). */
export const recentNotices = (ns: Notice[], days = NOTICE_DAYS) => { const cutoff = isoLocal(addDays(new Date(), -days)); return ns.filter((n) => n.date >= cutoff); };
/** Newest notice from the last `days` days that is region-wide or names a listed water and is dated after the DFO page
 * version the rules were transcribed from: the "rules changed, page not caught up yet" case. Clears once we reconcile. */
export const freshNotice = (ns: Notice[], pageDate: string, listed: (id: string) => boolean, days = 14) =>
  recentNotices(ns, days).find((n) => n.date > pageDate && (n.region || n.waters.some(listed))) ?? null;
export const noticesFor = (ns: Notice[], id: string) => ns.filter((n) => n.waters.includes(id));
/** Region-wide notices that name no specific water. */
export const regionNotices = (ns: Notice[]) => ns.filter((n) => n.region && n.waters.length === 0);
export const fmtNoticeDate = (d: string) => { const p = parseIso(d); return p ? fmtDate(p) : d; };
