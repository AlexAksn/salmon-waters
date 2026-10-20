// The data model every region's rules file is written in. Region-specific data lives in src/regions/<id>/:
// regs.ts (waters + rules), gauges.ts, region.json (DFO page, home view, notice patterns) and the geometry
// pipeline inputs (geo.json, waters.py). The app and the build scripts read the same region.json.

/** Salmon species the rules can name. Add here and everything (chips, strips, status, changing-soon) follows. */
export const SPECIES = [
  { id: 'chinook', label: 'Chinook', abbr: 'CH' },
  { id: 'coho', label: 'Coho', abbr: 'CO' },
  { id: 'chum', label: 'Chum', abbr: 'CM' },
  { id: 'pink', label: 'Pink', abbr: 'PK' },
  { id: 'sockeye', label: 'Sockeye', abbr: 'SK' },
] as const;
export type Fish = (typeof SPECIES)[number]['id'];
export type Species = Fish | 'all';
/** keep = retention allowed | nr = non-retention (catch & release) | closed = no fishing for salmon | gear = gear rule. */
export type RuleKind = 'keep' | 'nr' | 'closed' | 'gear';
/** from/to = "MM-DD" inclusive; to:null = until further notice; notice = the FN number that set this rule. */
export interface Rule { sp: Species; kind: RuleKind; from: string; to: string | null; limit?: string; notice?: string }
/** A water whose salmon rules are not on the region's page: tidal (another DFO area) or simply not listed. */
export interface Elsewhere { status: 'tidal' | 'none'; short: string; text: string; link?: string }
export interface Water {
  id: string; name: string; sub?: string; group?: string; area?: string; notes?: string[];
  rules: Rule[]; lake?: string; elsewhere?: Elsewhere;
}
export type City = [name: string, lon: number, lat: number, rank: 1 | 2 | 3];
/** Environment and Climate Change Canada real-time hydrometric station matched to a water. */
export interface Gauge { stn: string; name: string; note?: string }
/** From scripts/stations.mjs: where a station is, and HYDAT long-term mean discharge by month (index 0 = January). */
export interface StationInfo { lon: number; lat: number; typ: (number | null)[]; years: number[] }
/** src/regions/<id>/stations.json: every gauge's StationInfo and one bbox around them all. */
export interface StationsJson { fetched: string; bbox: number[]; stations: Record<string, StationInfo> }
export type BBox = [w: number, s: number, e: number, n: number];

/** src/regions/<id>/region.json. The scripts also read dfo.tableHash and the notice patterns from it. */
export interface RegionJson { id: string; num: number; name: string; dfo: { url: string; date: string; tableHash: string }; home: number[][]; dayNote: string }
export interface RegionMeta {
  id: string; num: number; name: string;
  /** The DFO page the rules were transcribed from, and the page date of that transcription. */
  dfo: { url: string; date: string };
  /** Initial map view, [[south, west], [north, east]]. */
  home: [[number, number], [number, number]];
  /** One line of region-wide limits shown under every water's rules. */
  dayNote: string;
}
export const toMeta = (j: RegionJson): RegionMeta => ({
  id: j.id, num: j.num, name: j.name, dfo: { url: j.dfo.url, date: j.dfo.date }, dayNote: j.dayNote,
  home: [[j.home[0][0], j.home[0][1]], [j.home[1][0], j.home[1][1]]],
});
/** Everything the app needs about one region once its module has loaded. */
export interface RegionData extends RegionMeta {
  waters: Water[]; byId: ReadonlyMap<string, Water>; cities: City[]; globalRules: string[];
  /** Fishery-notice number -> URL, for rules that cite one. */
  notices: Record<string, string>;
  gauges: Record<string, Gauge>;
  /** One realtime request for this box feeds every card's flow chip. */
  bbox: BBox;
  stations: Record<string, StationInfo>;
}
