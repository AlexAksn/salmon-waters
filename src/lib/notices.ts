import { addDays, fmtDate, isoLocal, parseIso } from './rules';

/** One DFO fishery notice, as produced by scripts/fetch-notices.mjs. */
export interface Notice { fn: string; docId: string; subject: string; date: string; sent: string; url: string; region: boolean; waters: string[] }
export interface NoticesFile { fetchedAt: string; ok: boolean; notices: Notice[] }

export const NOTICE_DAYS = 30;
/** Notices newer than `days` days (notices are kept sorted newest first). */
export const recentNotices = (ns: Notice[], days = NOTICE_DAYS) => { const cutoff = isoLocal(addDays(new Date(), -days)); return ns.filter((n) => n.date >= cutoff); };
export const noticesFor = (ns: Notice[], id: string) => ns.filter((n) => n.waters.includes(id));
/** Region-wide notices that name no specific water. */
export const regionNotices = (ns: Notice[]) => ns.filter((n) => n.region && n.waters.length === 0);
export const fmtNoticeDate = (d: string) => { const p = parseIso(d); return p ? fmtDate(p) : d; };
