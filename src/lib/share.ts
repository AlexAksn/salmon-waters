import type { RegionMeta, Water } from '../regions/model';
import { dayOfYear, fmtDate, MON, ruleLine, seasonRuns, SPN, STATUS_LABEL, SUMMARY, type SpeciesPick, type Status } from './rules';
import { fmtRange, groupEvents, type WeekendSummary } from './weekend';

// Share cards: 1200×630 PNGs (the Open Graph size) drawn on a canvas. One per river/day, one per region/weekend. Sent through
// the Web Share API as a bare image (Facebook drops an image whenever a URL rides along, so links go separately) or downloaded.

/** Fixed dark palette so cards look the same whatever theme the sender uses (values from styles.css dark mode). */
const C = { bg: '#0d1317', panel: '#151d22', fg: '#e6ece7', muted: '#9aa8a0', line: '#27333a', open: '#43c374', cr: '#f0a62a', closed: '#f26d50', none: '#6c7771', tidal: '#6ea4cd' };
const STATUS_COLOR: Record<Status, string> = { open: C.open, cr: C.cr, closed: C.closed, none: C.none, tidal: C.tidal };
const W = 1200, H = 630, PAD = 64;
const DISPLAY = "'Barlow Semi Condensed','Arial Narrow',system-ui,sans-serif", BODY = "'IBM Plex Sans',system-ui,sans-serif", MONO = "'IBM Plex Mono',Menlo,monospace";
const SITE = 'salmonwaters.ca';

export interface ShareInput { w: Water; date: Date; sp: SpeciesPick; status: Status; region: RegionMeta; url: string }

/** The lines under the status: one per species with a rule today, plus gear; the same digest the cards show. */
export function cardLines(w: Water, date: Date, sp: SpeciesPick): string[] {
  if (w.elsewhere) return [w.elsewhere.text];
  const rl = ruleLine(w, date, sp);
  if (rl.closed) return [rl.closed];
  const out = rl.all ? [`All salmon: ${rl.all}`] : rl.parts.map((p) => `${SPN[p.sp]}: ${p.text}`);
  if (!out.length) out.push('No salmon opportunity listed today'); // a single species always gets a part ("closed")
  return [...out, ...rl.gear.map((g) => `Gear: ${g}`)];
}
export const shareTitle = ({ w, date, status }: ShareInput) => `${w.name} · ${STATUS_LABEL[status]} · ${fmtDate(date)}`;

// ---- drawing helpers ----
/** Word-wrap `text` to `max` px in the current font; at most `lines` lines, the last one ellipsised. */
function wrap(ctx: CanvasRenderingContext2D, text: string, max: number, lines: number): string[] {
  const out: string[] = []; let cur = '';
  for (const word of text.split(' ')) {
    const t = cur ? `${cur} ${word}` : word;
    if (ctx.measureText(t).width <= max || !cur) cur = t;
    else { out.push(cur); cur = word; if (out.length === lines) break; }
  }
  if (out.length < lines) out.push(cur);
  else { let last = out[lines - 1]; while (last && ctx.measureText(`${last}…`).width > max) last = last.slice(0, -1); out[lines - 1] = `${last}…`; }
  return out.slice(0, lines);
}
function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}
/** Bold label, then the rest in regular weight; wraps to `lines` lines inside `max` px. Returns the lines used. */
function labelled(ctx: CanvasRenderingContext2D, label: string, rest: string, x: number, y: number, size: number, max: number, lines: number): number {
  ctx.fillStyle = C.fg; ctx.font = `600 ${size}px ${BODY}`;
  ctx.fillText(label, x, y);
  const lw = ctx.measureText(label).width + (rest ? ctx.measureText(' ').width : 0);
  ctx.font = `500 ${size}px ${BODY}`;
  // first line shares the row with the label; measure the rest against the remaining width, then full width
  const words = rest.split(' '); let cur = '', n = 0, cx = x + lw, avail = max - lw;
  const flush = () => { ctx.fillText(cur, cx, y + n * (size * 1.5)); n++; cx = x; avail = max; cur = ''; };
  for (const w of words) {
    const t = cur ? `${cur} ${w}` : w;
    if (ctx.measureText(t).width <= avail || !cur) cur = t;
    else { if (n === lines - 1) { cur = wrap(ctx, `${cur} ${w}`, avail, 1)[0]; break; } flush(); cur = w; }
  }
  if (cur) flush();
  return Math.max(1, n);
}
/** Blank card with the status stripe, the region header line and the footer. */
async function blank(stripe: string, region: RegionMeta): Promise<[HTMLCanvasElement, CanvasRenderingContext2D]> {
  if (typeof document !== 'undefined' && 'fonts' in document) {
    await Promise.all([`700 72px ${DISPLAY}`, `500 26px ${BODY}`, `500 20px ${MONO}`].map((f) => document.fonts.load(f).catch(() => []))).catch(() => undefined);
  }
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const ctx = cv.getContext('2d')!;
  ctx.fillStyle = C.bg; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = stripe; ctx.fillRect(0, 0, 14, H);
  ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left';
  ctx.fillStyle = C.muted; ctx.font = `500 20px ${MONO}`;
  ctx.fillText(`SALMON WATERS · ${region.name.toUpperCase()} · DFO REGION ${region.num}`, PAD, 70);
  ctx.fillStyle = C.line; ctx.fillRect(PAD, H - 72, W - PAD * 2, 1);
  ctx.fillStyle = C.muted; ctx.fillText(SITE, PAD, H - 34);
  ctx.textAlign = 'right'; ctx.fillText('Not official · check DFO before you go', W - PAD, H - 34); ctx.textAlign = 'left';
  return [cv, ctx];
}
function title(ctx: CanvasRenderingContext2D, text: string, y: number) {
  ctx.fillStyle = C.fg; ctx.font = `700 72px ${DISPLAY}`;
  let t = text; while (ctx.measureText(t).width > W - PAD * 2 && t.length > 4) t = `${t.slice(0, -2).trimEnd()}…`;
  ctx.fillText(t, PAD, y);
}

// ---- one river, one day ----
export async function drawCard(s: ShareInput): Promise<HTMLCanvasElement> {
  const { w, date, sp, status } = s;
  const [cv, ctx] = await blank(STATUS_COLOR[status], s.region);
  title(ctx, w.name, 150);
  let y = 150;
  if (w.sub) { ctx.fillStyle = C.muted; ctx.font = `500 26px ${BODY}`; ctx.fillText(wrap(ctx, w.sub, W - PAD * 2, 1)[0], PAD, y += 40); }

  // status pill · date
  y += 48;
  ctx.font = `700 34px ${DISPLAY}`;
  const label = STATUS_LABEL[status].toUpperCase(), pw = ctx.measureText(label).width + 44;
  ctx.fillStyle = STATUS_COLOR[status]; roundRect(ctx, PAD, y - 34, pw, 50, 10); ctx.fill();
  ctx.fillStyle = C.bg; ctx.fillText(label, PAD + 22, y + 2);
  ctx.fillStyle = C.fg; ctx.font = `600 30px ${BODY}`; ctx.fillText(fmtDate(date), PAD + pw + 22, y);

  // rule lines
  y += 52;
  ctx.font = `500 26px ${BODY}`;
  let used = 0;
  for (const l of cardLines(w, date, sp)) {
    if (used >= 4) break;
    const i = l.indexOf(':'), [lab, rest] = i > 0 && i < 24 ? [l.slice(0, i + 1), l.slice(i + 2)] : ['', l];
    const n = labelled(ctx, lab, rest, PAD, y, 26, W - PAD * 2, Math.min(2, 4 - used)); used += n; y += 39 * n;
  }

  // season strip for the shared species (Any = the union the status uses), with today marked
  if (!w.elsewhere) {
    const sy = 470, sh = 22, sw = W - PAD * 2;
    ctx.fillStyle = C.panel; roundRect(ctx, PAD, sy, sw, sh, 4); ctx.fill();
    for (const r of seasonRuns(w, sp, date.getFullYear())) {
      if (r.st === 'none' || r.st === 'tidal') continue;
      ctx.fillStyle = STATUS_COLOR[r.st]; ctx.fillRect(PAD + (r.start / 365) * sw, sy, Math.max(2, (r.n / 365) * sw), sh);
    }
    ctx.fillStyle = C.muted; ctx.font = `500 16px ${MONO}`; ctx.textAlign = 'center';
    MON.forEach((m, i) => ctx.fillText(m[0], PAD + ((i + 0.5) / 12) * sw, sy + sh + 22));
    ctx.textAlign = 'left';
    const nx = PAD + (dayOfYear(date) / 365) * sw;
    ctx.fillStyle = C.fg; ctx.fillRect(nx - 1.5, sy - 6, 3, sh + 12);
    ctx.font = `500 18px ${MONO}`; ctx.fillStyle = C.muted; ctx.fillText(`${sp === 'any' ? 'Any salmon' : SPN[sp]} · ${date.getFullYear()} season`, PAD, sy - 14);
  }
  return cv;
}

// ---- one region, one weekend ----
export interface WeekendInput { region: RegionMeta; date: Date; summary: WeekendSummary }
export const weekendTitle = ({ region, summary: s }: WeekendInput) => `${region.name} · weekend of ${fmtRange(s.sat, s.sun)} · ${s.counts.open} open, ${s.events.length} change${s.events.length === 1 ? '' : 's'}`;
export async function drawWeekend(i: WeekendInput): Promise<HTMLCanvasElement> {
  const { date, summary: s } = i;
  const [cv, ctx] = await blank(C.open, i.region);
  title(ctx, `This weekend · ${fmtRange(s.sat, s.sun)}`, 150);

  // counts: big numbers in status colours
  let x = PAD; const y = 236;
  for (const [k, label] of SUMMARY) {
    ctx.fillStyle = STATUS_COLOR[k]; ctx.font = `700 64px ${DISPLAY}`;
    const n = String(s.counts[k]); ctx.fillText(n, x, y);
    const nw = ctx.measureText(n).width;
    ctx.fillStyle = C.muted; ctx.font = `500 18px ${MONO}`; ctx.fillText(label.toUpperCase(), x + nw + 12, y);
    x += nw + 12 + ctx.measureText(label.toUpperCase()).width + 56;
  }

  // changes between the date and Sunday
  ctx.fillStyle = C.muted; ctx.font = `500 18px ${MONO}`;
  ctx.fillText(s.events.length ? `CHANGES ${fmtDate(date).toUpperCase()} → SUN ${s.sun.getDate()}` : 'CHANGES THROUGH SUNDAY', PAD, 300);
  let ly = 340;
  if (!s.events.length) { ctx.fillStyle = C.fg; ctx.font = `500 26px ${BODY}`; ctx.fillText('No rule changes. What is open today stays open through the weekend.', PAD, ly); }
  const groups = groupEvents(s.events), maxLines = 5; let used = 0, shown = 0;
  for (const g of groups) {
    if (used >= maxLines) break;
    ctx.fillStyle = C.muted; ctx.font = `500 20px ${MONO}`; ctx.fillText(fmtDate(g.d), PAD, ly);
    ctx.fillStyle = g.color === 'gear' ? C.tidal : STATUS_COLOR[g.color]; ctx.fillRect(PAD + 86, ly - 16, 4, 20);
    const n = labelled(ctx, `${g.text}:`, g.names.join(', '), PAD + 104, ly, 24, W - PAD * 2 - 104, Math.min(2, maxLines - used));
    used += n; shown++; ly += 36 * n + 4;
  }
  if (shown < groups.length) { ctx.fillStyle = C.muted; ctx.font = `500 20px ${BODY}`; ctx.fillText(`+${groups.length - shown} more, see the app`, PAD + 104, ly); }
  return cv;
}

// ---- sending ----
const toBlob = (cv: HTMLCanvasElement) => new Promise<Blob>((res, rej) => cv.toBlob((b) => (b ? res(b) : rej(new Error('toBlob'))), 'image/png'));
const ymd = (d: Date) => `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;

export type ShareMode = 'link' | 'card';
export type ShareResult = 'shared' | 'copied' | 'saved' | 'cancelled' | 'failed';
async function sheet(data: ShareData): Promise<ShareResult | null> {
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
  if (typeof nav.share !== 'function' || (data.files && nav.canShare && !nav.canShare(data))) return null;
  try { await nav.share(data); return 'shared'; } catch (e) { return (e as Error).name === 'AbortError' ? 'cancelled' : null; }
}
/** The PNG alone through the share sheet (a photo post), else a download. */
async function shareImage(draw: () => Promise<HTMLCanvasElement>, name: string, title: string): Promise<ShareResult> {
  let file: File;
  try { file = new File([await toBlob(await draw())], name, { type: 'image/png' }); } catch { return 'failed'; }
  const r = await sheet({ title, files: [file] });
  if (r) return r;
  const a = document.createElement('a'); a.href = URL.createObjectURL(file); a.download = file.name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 10_000);
  return 'saved';
}
/** 'link': the URL (and title) — Facebook and friends make a link post with the site card. 'card': the river PNG alone.
 *  Facebook ignores an image whenever a URL is in the payload, so the two are not combined. Without a share sheet,
 *  'link' copies the URL and 'card' downloads the image. */
export async function shareWater(s: ShareInput, mode: ShareMode): Promise<ShareResult> {
  const t = shareTitle(s);
  if (mode === 'card') return shareImage(() => drawCard(s), `salmon-waters-${s.w.id}-${ymd(s.date)}.png`, t);
  const r = await sheet({ title: t, text: `${t}\n${s.url}`, url: s.url });
  if (r) return r;
  try { await navigator.clipboard.writeText(s.url); return 'copied'; } catch { return 'failed'; }
}
export const shareWeekend = (i: WeekendInput) => shareImage(() => drawWeekend(i), `salmon-waters-${i.region.id}-weekend-${ymd(i.summary.sat)}.png`, weekendTitle(i));
