import type { RegionMeta, Water } from '../regions/model';
import { dayOfYear, fmtDate, MON, ruleLine, seasonRuns, SPN, STATUS_LABEL, type SpeciesPick, type Status } from './rules';

// A share card: 1200×630 PNG (the Open Graph size) drawn on a canvas, plus the text that goes with it. Sent through the
// Web Share API when the browser has it (phones), otherwise the link is copied and the image downloaded.

/** Fixed dark palette so cards look the same whatever theme the sender uses (values from styles.css dark mode). */
const C = { bg: '#0d1317', panel: '#151d22', fg: '#e6ece7', muted: '#9aa8a0', line: '#27333a', open: '#43c374', cr: '#f0a62a', closed: '#f26d50', none: '#6c7771', tidal: '#6ea4cd' };
const STATUS_COLOR: Record<Status, string> = { open: C.open, cr: C.cr, closed: C.closed, none: C.none, tidal: C.tidal };
const W = 1200, H = 630, PAD = 64;
const DISPLAY = "'Barlow Semi Condensed','Arial Narrow',system-ui,sans-serif", BODY = "'IBM Plex Sans',system-ui,sans-serif", MONO = "'IBM Plex Mono',Menlo,monospace";

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
export const shareText = (s: ShareInput) => [shareTitle(s), ...cardLines(s.w, s.date, s.sp), 'Not official · check DFO before you go', s.url].join('\n');

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

export async function drawCard(s: ShareInput): Promise<HTMLCanvasElement> {
  const { w, date, sp, status, region } = s;
  if (typeof document !== 'undefined' && 'fonts' in document) {
    await Promise.all([`700 72px ${DISPLAY}`, `500 26px ${BODY}`, `500 20px ${MONO}`].map((f) => document.fonts.load(f).catch(() => []))).catch(() => undefined);
  }
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const ctx = cv.getContext('2d')!;
  ctx.fillStyle = C.bg; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = STATUS_COLOR[status]; ctx.fillRect(0, 0, 14, H); // status stripe, like the card's left border
  ctx.textBaseline = 'alphabetic';

  // header: brand · region
  ctx.fillStyle = C.muted; ctx.font = `500 20px ${MONO}`;
  ctx.fillText(`SALMON WATERS · ${region.name.toUpperCase()} · DFO REGION ${region.num}`, PAD, 70);

  // river name (+ sub)
  ctx.fillStyle = C.fg; ctx.font = `700 72px ${DISPLAY}`;
  let name = w.name; while (ctx.measureText(name).width > W - PAD * 2 && name.length > 4) name = `${name.slice(0, -2).trimEnd()}…`;
  ctx.fillText(name, PAD, 150);
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
  const lines = cardLines(w, date, sp).flatMap((l) => wrap(ctx, l, W - PAD * 2, 2)).slice(0, 4);
  for (const l of lines) {
    const i = l.indexOf(':');
    if (i > 0 && i < 20) { ctx.fillStyle = C.fg; ctx.font = `600 26px ${BODY}`; ctx.fillText(l.slice(0, i + 1), PAD, y); const bw = ctx.measureText(l.slice(0, i + 1)).width; ctx.font = `500 26px ${BODY}`; ctx.fillStyle = C.fg; ctx.fillText(l.slice(i + 1), PAD + bw, y); }
    else { ctx.fillStyle = C.fg; ctx.fillText(l, PAD, y); }
    y += 38;
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

  // footer
  ctx.fillStyle = C.line; ctx.fillRect(PAD, H - 72, W - PAD * 2, 1);
  ctx.fillStyle = C.muted; ctx.font = `500 20px ${MONO}`;
  ctx.fillText('alexaksn.github.io/salmon-waters', PAD, H - 34);
  ctx.textAlign = 'right'; ctx.fillText('Not official · check DFO before you go', W - PAD, H - 34); ctx.textAlign = 'left';
  return cv;
}

const toBlob = (cv: HTMLCanvasElement) => new Promise<Blob>((res, rej) => cv.toBlob((b) => (b ? res(b) : rej(new Error('toBlob'))), 'image/png'));
const fileName = (s: ShareInput) => `salmon-waters-${s.w.id}-${s.date.getFullYear()}${String(s.date.getMonth() + 1).padStart(2, '0')}${String(s.date.getDate()).padStart(2, '0')}.png`;

export type ShareResult = 'shared' | 'copied' | 'cancelled' | 'failed';
/** Share sheet with image + text + link where supported; otherwise copy the link and save the image. */
export async function shareWater(s: ShareInput): Promise<ShareResult> {
  const text = shareText(s), title = shareTitle(s);
  let file: File | null = null;
  try { file = new File([await toBlob(await drawCard(s))], fileName(s), { type: 'image/png' }); } catch { file = null; }
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
  if (typeof nav.share === 'function') {
    // With files attached some targets drop `url`, so it is already in `text`.
    const data: ShareData = file && nav.canShare?.({ files: [file] }) ? { title, text, files: [file] } : { title, text: `${title}\n${s.url}`, url: s.url };
    try { await nav.share(data); return 'shared'; } catch (e) { if ((e as Error).name === 'AbortError') return 'cancelled'; }
  }
  let copied = false;
  try { await navigator.clipboard.writeText(s.url); copied = true; } catch { copied = false; }
  if (file) { const a = document.createElement('a'); a.href = URL.createObjectURL(file); a.download = file.name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 10_000); }
  return copied ? 'copied' : 'failed';
}
