// Source: DFO "Region 1 - Vancouver Island: Recreational salmon fishing limits, openings and closures"
// (url, page date and table hash live in ./region.json; scripts/check-dfo.mjs compares against it at build).
// Edit this file when DFO updates the page. Rules the page marks "To be determined" are carried as notes, not rules.
// Small in-river closures (hatchery fences, weirs, named pools) are notes on the stretch they sit in; stretches with
// their own seasons are separate waters.
import type { City, Elsewhere, Rule, Water } from '../model';

export const NOTICES: Record<string, string> = {
  FN0435: 'https://notices.dfo-mpo.gc.ca/fns-sap/index-eng.cfm?pg=view_notice&DOC_ID=352752&ID=all',
  FN0504: 'https://notices.dfo-mpo.gc.ca/fns-sap/index-eng.cfm?pg=view_notice&DOC_ID=355075&ID=all',
  FN0905: 'https://notices.dfo-mpo.gc.ca/fns-sap/index-eng.cfm?pg=view_notice&DOC_ID=364628&ID=all',
  FN0937: 'https://notices.dfo-mpo.gc.ca/fns-sap/index-eng.cfm?pg=view_notice&DOC_ID=365606&ID=all',
  FN0938: 'https://notices.dfo-mpo.gc.ca/fns-sap/index-eng.cfm?pg=view_notice&DOC_ID=365613&ID=all',
  FN0939: 'https://notices.dfo-mpo.gc.ca/fns-sap/index-eng.cfm?pg=view_notice&DOC_ID=365620&ID=all',
  FN0952: 'https://notices.dfo-mpo.gc.ca/fns-sap/index-eng.cfm?pg=view_notice&DOC_ID=365953&ID=all',
  FN1013: 'https://notices.dfo-mpo.gc.ca/fns-sap/index-eng.cfm?pg=view_notice&DOC_ID=367531&ID=all',
  FN1069: 'https://notices.dfo-mpo.gc.ca/fns-sap/index-eng.cfm?pg=view_notice&DOC_ID=368896&ID=all',
};
export const GLOBAL_RULES: string[] = [
  'Unless a water is listed, the daily limit for salmon in Region 1 is zero.',
  'Annual bait ban in all streams of Region 1 except the Quatse, Somass and Sproat Rivers and the Stamp River below Girl Guide Falls (those four have seasonal bait bans instead).',
  'No fishing within 100 m of any government facility used for counting, passing or rearing fish, unless otherwise stated.',
  'Daily limit for all Pacific salmon, tidal and fresh waters combined: 4. Individual species limits also apply.',
  'Possession limit: twice the daily limit (max 8 salmon), except salmon at your ordinary residence.',
  'Annual limit: 10 chinook over 50 cm from all fresh waters combined.',
  'Minimum sizes (nose to tail fork): coho 25 cm; chinook and sockeye 30 cm.',
  '"Adult chinook" in Region 1 is over 50 cm.',
];
/** Region 1's one default for rivers the page does not list. */
export const ZONE: Record<'r1', Elsewhere> = {
  r1: { status: 'none', short: 'Daily limit 0 for salmon (not listed)', text: 'Unless a water is listed in the DFO Region 1 table, the daily limit for salmon is zero. This river is not listed.' },
};
const YEAR = { from: '04-01', to: '03-31' } as const; // DFO's "Apr 1 to Mar 31"
const BAIT_BAN: Rule = { sp: 'all', kind: 'gear', ...YEAR, limit: 'Bait ban' };
const HOOK: Rule = { sp: 'all', kind: 'gear', ...YEAR, limit: 'Single barbless hook, gap under 15 mm' };
const TBD = (sp: string) => `${sp}: opening to be determined by DFO (watch the fishery notices).`;
// Stamp and Somass share one set of general rules; their named reaches add a closure or a sockeye opening on top.
const STAMP_RULES: Rule[] = [
  { sp: 'chinook', kind: 'keep', from: '08-25', to: '12-31', limit: '2 per day, only 1 over 77 cm' },
  { sp: 'coho', kind: 'keep', from: '08-25', to: '09-18', limit: '2 per day, hatchery marked only', notice: 'FN0504' },
  { sp: 'coho', kind: 'keep', from: '09-19', to: '10-02', limit: '2 per day, 1 may be unmarked', notice: 'FN1013' },
  { sp: 'coho', kind: 'keep', from: '10-03', to: '12-31', limit: '2 per day, 2 may be unmarked', notice: 'FN1069' },
];
const SOMASS_RULES: Rule[] = [
  { sp: 'all', kind: 'gear', from: '06-01', to: '08-24', limit: 'Bait ban' },
  { sp: 'chinook', kind: 'keep', from: '08-25', to: '12-31', limit: '2 per day, only 1 over 77 cm' },
  { sp: 'coho', kind: 'keep', from: '08-25', to: '09-18', limit: '2 per day, hatchery marked only', notice: 'FN0504' },
  { sp: 'coho', kind: 'keep', from: '09-19', to: '12-31', limit: '2 per day, 1 may be unmarked', notice: 'FN1013' },
];
const CAMPBELL_RULES: Rule[] = [
  { sp: 'coho', kind: 'keep', from: '09-01', to: '12-31', limit: '4 hatchery marked per day', notice: 'FN0939' },
  { sp: 'pink', kind: 'keep', from: '07-15', to: '10-15', limit: '4 per day' },
];
const NANAIMO_NR: Rule = { sp: 'coho', kind: 'nr', from: '10-15', to: null, notice: 'FN0952' };
const LQ_RULES: Rule[] = [
  HOOK, { sp: 'all', kind: 'gear', from: '09-01', to: '11-30', limit: 'Fly fishing only' },
  { sp: 'chinook', kind: 'keep', from: '09-01', to: '11-30', limit: '2 per day' },
  { sp: 'coho', kind: 'keep', from: '10-01', to: '11-30', limit: '1 per day, hatchery marked only' },
];
const LISTED: Water[] = [
  { id: 'adam-eve', name: 'Adam and Eve Rivers', sub: 'north Island, near Sayward', area: 'Adam River and Eve River.',
    rules: [{ sp: 'pink', kind: 'keep', from: '08-25', to: '09-30', limit: '4 per day', notice: 'FN0905' }, BAIT_BAN] },
  { id: 'campbell', name: 'Campbell River', sub: 'Quinsam confluence down to Maple St', group: 'Campbell River',
    area: 'Downstream of the confluence with the Quinsam River to the fishing boundary sign at the end of Maple Street.',
    notes: [TBD('Chinook')], rules: [...CAMPBELL_RULES, BAIT_BAN] },
  { id: 'campbell-mouth', name: 'Campbell River', sub: 'Maple St down to the cement block', group: 'Campbell River',
    area: 'From the fishing boundary sign at the end of Maple Street downstream to the fishing boundary sign at the cement block.',
    notes: [TBD('Chinook'), 'The Maple Street and cement-block signs are placed approximately on the map.'], rules: [{ sp: 'all', kind: 'closed', from: '08-01', to: '10-31', limit: 'No fishing (Aug 1 – Oct 31)' }, ...CAMPBELL_RULES, BAIT_BAN] },
  { id: 'cayeghle', name: 'Cayeghle River', sub: 'incl. Colonial River', area: 'Cayeghle River including the Colonial River.',
    rules: [{ sp: 'coho', kind: 'keep', ...YEAR, limit: '1 per day' }, BAIT_BAN] },
  { id: 'chemainus', name: 'Chemainus River', rules: [{ sp: 'coho', kind: 'keep', from: '10-15', to: '03-31', limit: '1 per day, maximum size 35 cm' }, BAIT_BAN] },
  { id: 'cluxewe', name: 'Cluxewe River', sub: 'near Port McNeill', rules: [{ sp: 'coho', kind: 'keep', ...YEAR, limit: '2 per day, hatchery marked only' }, BAIT_BAN] },
  { id: 'comox-lake', name: 'Comox Lake', lake: 'Comox Lake', rules: [{ sp: 'all', kind: 'closed', from: '07-01', to: '03-31', limit: 'No fishing for salmon (Jul 1 – Mar 31)' }] },
  { id: 'conuma', name: 'Conuma River', sub: 'Tlupana Inlet, west coast',
    rules: [{ sp: 'chinook', kind: 'keep', from: '08-25', to: '12-31', limit: '2 per day, only 1 over 77 cm' }, { sp: 'coho', kind: 'keep', from: '08-25', to: '12-31', limit: '2 per day, hatchery marked only' }, BAIT_BAN] },
  { id: 'courtenay', name: 'Courtenay River', sub: 'below the Puntledge / Tsolum confluence', area: 'The waters below the confluence of the Puntledge and Tsolum Rivers.',
    notes: [TBD('Chum')], rules: [{ sp: 'chinook', kind: 'keep', from: '09-01', to: '12-31', limit: '2 per day' }, { sp: 'coho', kind: 'keep', from: '09-01', to: '12-31', limit: '4 hatchery marked per day', notice: 'FN0938' }, BAIT_BAN] },
  { id: 'cowichan-upper', name: 'Cowichan River', sub: '66 Mile Trestle down to Sandy Pool', group: 'Cowichan River',
    area: 'From the 66 Mile Trestle downstream to the white triangle boundary sign in Sandy Pool Regional Park.', notes: [TBD('Chum')],
    rules: [{ sp: 'all', kind: 'nr', from: '09-01', to: '07-14', limit: 'Catch and release for all salmon' }, { sp: 'coho', kind: 'keep', from: '11-01', to: '12-31', limit: '1 per day' }, BAIT_BAN] },
  { id: 'cowichan-lower', name: 'Cowichan River', sub: 'Sandy Pool down to the tidal boundary', group: 'Cowichan River',
    area: 'From the white triangle boundary sign in Sandy Pool Regional Park downstream to the tidal boundary.', notes: [TBD('Chum')],
    rules: [{ sp: 'all', kind: 'closed', from: '09-01', to: '11-15', limit: 'No fishing (Sep 1 – Nov 15)' }, { sp: 'coho', kind: 'keep', from: '11-16', to: '12-31', limit: '1 per day' }, BAIT_BAN] },
  { id: 'goldstream', name: 'Goldstream River', sub: 'near Victoria', rules: [{ sp: 'all', kind: 'closed', ...YEAR, limit: 'No fishing' }] },
  { id: 'koksilah', name: 'Koksilah River', sub: 'incl. tributaries', area: 'Koksilah River including tributaries.',
    rules: [{ sp: 'coho', kind: 'keep', ...YEAR, limit: '1 per day, maximum size 35 cm' }, { sp: 'all', kind: 'closed', from: '07-01', to: '09-30', limit: 'No fishing (Jul 1 – Sep 30)' }, { sp: 'all', kind: 'closed', from: '12-01', to: '05-31', limit: 'No fishing (Dec 1 – May 31)' }, BAIT_BAN] },
  { id: 'little-qualicum', name: 'Little Qualicum River', sub: 'hatchery fence down to the sea', group: 'Little Qualicum River',
    area: 'All open waters below the hatchery fence.', notes: ['Closed year-round from the hatchery fence to the signs about 35 m downstream.'], rules: [...LQ_RULES, BAIT_BAN] },
  { id: 'little-qualicum-upper', name: 'Little Qualicum River', sub: 'the falls down to the hatchery fence', group: 'Little Qualicum River',
    area: 'From the falls in Little Qualicum Falls Provincial Park downstream to the hatchery fence.',
    rules: [{ sp: 'all', kind: 'closed', from: '12-01', to: '05-31', limit: 'No fishing (Dec 1 – May 31)' }, ...LQ_RULES, BAIT_BAN] },
  { id: 'nahwitti', name: 'Nahwitti River', sub: 'north tip of the Island', rules: [{ sp: 'coho', kind: 'keep', ...YEAR, limit: '1 per day' }, BAIT_BAN] },
  { id: 'nanaimo-tidal', name: 'Nanaimo River', sub: 'tidal: Cedar Rd bridge down to the sea', group: 'Nanaimo River',
    area: 'The tidal portion (Subarea 17-14) from the Cedar Road Bridge downstream.',
    notes: ['Closed Oct 25 – Nov 30 from the Cedar Bridge to the white square boundary signs about 400 m downstream.', 'Tidal water: outside these closures the Area 17 tidal salmon regulations apply.'],
    rules: [{ sp: 'all', kind: 'closed', from: '07-15', to: '10-25', limit: 'No fishing (Jul 15 – Oct 25)' }, NANAIMO_NR] },
  { id: 'nanaimo-lower', name: 'Nanaimo River', sub: 'Cedar Rd bridge up to the Hwy 1 bridge (Cassidy)', group: 'Nanaimo River',
    area: 'From the upstream side of the Cedar Road Bridge upstream to the downstream side of the Highway 1 overpass at Cassidy.',
    notes: ['Closed Sep 1 – Oct 15 from the Cedar Road Bridge up to the Highway 19 (Nanaimo Parkway) bridge, the first 260 m of this stretch.'],
    rules: [{ sp: 'coho', kind: 'keep', from: '10-16', to: '12-31', limit: '4 per day, hatchery marked only', notice: 'FN0952' }, { sp: 'chum', kind: 'keep', from: '11-01', to: '12-31', limit: '2 per day' }, NANAIMO_NR, BAIT_BAN] },
  { id: 'nanaimo-upper', name: 'Nanaimo River', sub: 'Hwy 1 bridge up to the Bore Hole', group: 'Nanaimo River',
    area: 'From the Highway 1 overpass at Cassidy upstream to 500 m below the lower power line crossing at the Bore Hole. Tributaries included.', rules: [NANAIMO_NR, BAIT_BAN] },
  { id: 'nanaimo-canyon', name: 'Nanaimo River', sub: 'Bore Hole up to Boulder Creek', group: 'Nanaimo River',
    area: 'From 500 m below the lower power line crossing at the Bore Hole upstream to the fishing boundary signs at the mouth of Boulder Creek.',
    rules: [{ sp: 'all', kind: 'closed', ...YEAR, limit: 'No fishing' }] },
  { id: 'nanaimo-above', name: 'Nanaimo River', sub: 'above Boulder Creek', group: 'Nanaimo River',
    area: 'Upstream of the fishing boundary signs at the mouth of Boulder Creek, including tributaries.', rules: [NANAIMO_NR, BAIT_BAN] },
  { id: 'nitinat', name: 'Nitinat River', sub: 'below Parker Creek', group: 'Nitinat River', area: 'Downstream of Parker Creek, except the closures noted.',
    notes: ['Finfish closure Aug 25 – Oct 15 within 50 m of the Nitinat River bridge.', 'Finfish closure year-round from the powerline crossing above the hatchery water intake down to the Little Nitinat River confluence.', 'Finfish closure Aug 25 – Dec 31 within about 100 m of Red Rock Pool.'],
    rules: [
      { sp: 'chinook', kind: 'keep', from: '08-25', to: '09-30', limit: '2 per day, only 1 over 77 cm' },
      { sp: 'coho', kind: 'keep', from: '08-25', to: '09-30', limit: '2 hatchery marked per day' }, { sp: 'coho', kind: 'keep', from: '10-16', to: '12-31', limit: '2 hatchery marked per day' },
      { sp: 'chum', kind: 'nr', from: '08-25', to: '09-30' }, { sp: 'chum', kind: 'nr', from: '10-16', to: '12-31' }, BAIT_BAN,
    ] },
  { id: 'nitinat-upper', name: 'Nitinat River', sub: 'above Parker Creek', group: 'Nitinat River', area: 'Upstream of Parker Creek.', rules: [{ sp: 'all', kind: 'closed', ...YEAR, limit: 'No fishing for salmon' }] },
  { id: 'puntledge', name: 'Puntledge River', sub: 'below Stotan Falls', area: 'Downstream from the base of Stotan Falls (about 450 m below the Duncan Bay Mainline logging road bridge).',
    notes: ['Closed year-round from 50 m above the BC Hydro generating station tailrace to 75 m below the hatchery fish fence (about 500 m).', 'Closed year-round within 100 m of the Morrison Creek confluence.', TBD('Chum')],
    rules: [{ sp: 'coho', kind: 'keep', from: '09-01', to: '12-31', limit: '4 hatchery marked per day', notice: 'FN0938' }, { sp: 'chinook', kind: 'keep', from: '09-01', to: '12-31', limit: '2 per day' }, BAIT_BAN] },
  { id: 'qualicum-upper', name: 'Qualicum River', sub: 'above the hatchery upper weir', group: 'Qualicum (Big Qualicum) River',
    area: 'Upstream of the Big Qualicum Hatchery upper weir (about 125 m below the E&N railway bridge).',
    rules: [HOOK, { sp: 'chinook', kind: 'keep', from: '08-30', to: '12-31', limit: '2 per day' }, { sp: 'coho', kind: 'keep', from: '09-01', to: '12-31', limit: '4 hatchery marked per day', notice: 'FN0937' }, { sp: 'pink', kind: 'keep', from: '08-15', to: '10-15', limit: '4 per day' }, BAIT_BAN] },
  { id: 'qualicum-hatchery', name: 'Qualicum River', sub: 'upper weir down to the QFN fence', group: 'Qualicum (Big Qualicum) River',
    area: 'From the upper weir (about 125 m below the E&N railway bridge) downstream to the QFN boundary fence about 100 m below the hatchery counting fence.',
    rules: [{ sp: 'all', kind: 'closed', from: '08-15', to: '10-15', limit: 'No fishing for salmon (Aug 15 – Oct 15)' }, HOOK, BAIT_BAN] },
  { id: 'qualicum-lower', name: 'Qualicum River', sub: 'QFN fence down to the Hwy 19A bridge', group: 'Qualicum (Big Qualicum) River',
    area: 'Below the QFN boundary fence, downstream to the Highway 19A bridge.', rules: [{ sp: 'all', kind: 'closed', ...YEAR, limit: 'No fishing for salmon' }] },
  { id: 'quatse', name: 'Quatse River', sub: 'Port Hardy', notes: ['Closed year-round within 100 m of the Quatse River Hatchery weir.', 'No bait ban (one of four exceptions in Region 1).'],
    rules: [{ sp: 'coho', kind: 'keep', from: '06-16', to: '03-31', limit: '2 per day, hatchery marked only' }] },
  { id: 'quinsam', name: 'Quinsam River', sub: 'Campbell River tributary', rules: [...CAMPBELL_RULES, BAIT_BAN] },
  { id: 'reay', name: 'Reay Creek', sub: 'Sidney', rules: [{ sp: 'all', kind: 'closed', ...YEAR, limit: 'No fishing for salmon' }] },
  { id: 'san-juan', name: 'San Juan River', sub: 'below the Fleet River, incl. tributaries', area: 'The San Juan River and its tributaries downstream of the Fleet River.',
    notes: [TBD('Coho'), 'Hatchery zone (from the counting fence down about 150 m, and the Fairy Lake tributary below the holding pens): closure dates to be determined.'], rules: [BAIT_BAN] },
  { id: 'seymour-inlet', name: 'Seymour River', sub: 'Seymour Inlet, mainland coast', rules: [{ sp: 'coho', kind: 'keep', ...YEAR, limit: '2 per day' }, BAIT_BAN] },
  { id: 'shawnigan', name: 'Shawnigan Creek', rules: [{ sp: 'all', kind: 'closed', ...YEAR, limit: 'No fishing for salmon' }] },
  { id: 'somass', name: 'Somass River', sub: 'except Somass Park and the Paper Mill Dam reach', group: 'Somass River',
    notes: ['No bait ban outside Jun 1 – Aug 24 (one of four exceptions in Region 1).'], rules: SOMASS_RULES },
  { id: 'somass-park', name: 'Somass River', sub: 'Somass Park reach', group: 'Somass River',
    area: 'From the northern boundary of Somass Park (off Service Road) downstream to the southern boundary of the park. Square boundary signs may mark these.',
    rules: [{ sp: 'sockeye', kind: 'keep', from: '05-01', to: '07-23', limit: '1 per day, 05:00 – 22:00 only', notice: 'FN0435' }, ...SOMASS_RULES] },
  { id: 'somass-papermill', name: 'Somass River', sub: 'Paper Mill Dam reach', group: 'Somass River',
    area: 'From the tidal boundary signs at the top of the rapids at Paper Mill Dam upstream about 0.5 km to the northeast corner of Collins Farm.',
    rules: [{ sp: 'all', kind: 'closed', from: '08-25', to: '11-15', limit: 'Finfish closure (Aug 25 – Nov 15)' }, ...SOMASS_RULES] },
  { id: 'sproat', name: 'Sproat River', sub: 'below the Hwy 4 pool', group: 'Sproat River', area: 'From about 300 m below the Highway 4 bridge downstream to the Stamp confluence.',
    notes: ['No bait ban outside May 1 – Oct 31 (one of four exceptions in Region 1).'],
    rules: [{ sp: 'all', kind: 'gear', from: '05-01', to: '10-31', limit: 'Bait ban' }, { sp: 'all', kind: 'nr', ...YEAR, limit: 'No retention of salmon' }] },
  { id: 'sproat-upper', name: 'Sproat River', sub: 'Sproat Lake down to the Hwy 4 pool', group: 'Sproat River',
    area: 'From Sproat Lake to about 300 m below the Highway 4 bridge, at the downstream end of the pool below the rapids at the Sproat River fishway.',
    rules: [{ sp: 'all', kind: 'closed', from: '06-15', to: '11-15', limit: 'Finfish closure (Jun 15 – Nov 15)' }, { sp: 'all', kind: 'gear', from: '05-01', to: '10-31', limit: 'Bait ban' }, { sp: 'all', kind: 'nr', ...YEAR, limit: 'No retention of salmon' }] },
  { id: 'stamp-upper', name: 'Stamp River', sub: 'Ash River confluence up to Great Central Lake dam', group: 'Stamp River',
    area: 'From the confluence of the Ash River upstream to the Great Central Lake dam, including tributaries.',
    notes: ['Finfish closure Aug 25 – Oct 31 from the inlet above the Robertson Creek Hatchery lagoon down to the lagoon outlet.', 'Finfish closure Oct 1 – 14 from the powerline crossing about 500 m down to the lagoon inlet.'],
    rules: [{ sp: 'all', kind: 'closed', from: '01-01', to: '04-30', limit: 'Finfish closure (Jan 1 – Apr 30)' }, ...STAMP_RULES, BAIT_BAN] },
  { id: 'stamp', name: 'Stamp River', sub: 'Girl Guide Falls up to the Ash River confluence', group: 'Stamp River',
    area: 'From Girl Guide Falls (about 275 m above the mouth of Beaver Creek) upstream to the Ash River confluence.',
    notes: ['Finfish closure Jun 15 – Nov 15 from about 200 m above the Stamp Falls fishway to 500 m below it.'], rules: [...STAMP_RULES, BAIT_BAN] },
  { id: 'stamp-lower', name: 'Stamp River', sub: 'Girl Guide Falls down to the Sproat confluence', group: 'Stamp River',
    area: 'Downstream of Girl Guide Falls (about 275 m above the mouth of Beaver Creek) to where the Sproat River joins to form the Somass.',
    notes: ['No bait ban outside Jun 1 – Aug 24 (one of four exceptions in Region 1).'], rules: [{ sp: 'all', kind: 'gear', from: '06-01', to: '08-24', limit: 'Bait ban' }, ...STAMP_RULES] },
  { id: 'washlawlis', name: 'Washlawlis River', rules: [{ sp: 'coho', kind: 'keep', ...YEAR, limit: '1 per day' }, BAIT_BAN] },
  { id: 'waukwaas', name: 'Waukwaas River', rules: [{ sp: 'coho', kind: 'keep', ...YEAR, limit: '1 per day' }, BAIT_BAN] },
];
// Rivers with no listed salmon opportunity (shown thin grey so the answer "no" is visible on the map)
export const UNLISTED: { id: string; name: string; note?: string }[] = [
  { id: 'u-englishman', name: 'Englishman River' }, { id: 'u-oyster', name: 'Oyster River' }, { id: 'u-salmon-sayward', name: 'Salmon River (Sayward)' },
  { id: 'u-nimpkish', name: 'Nimpkish River' }, { id: 'u-gold', name: 'Gold River' }, { id: 'u-sooke', name: 'Sooke River' }, { id: 'u-sarita', name: 'Sarita River' },
  { id: 'u-tsolum', name: 'Tsolum River' }, { id: 'u-marble', name: 'Marble River' }, { id: 'u-keogh', name: 'Keogh River' }, { id: 'u-zeballos', name: 'Zeballos River' },
  { id: 'u-tsitika', name: 'Tsitika River' }, { id: 'u-kokish', name: 'Kokish River' }, { id: 'u-browns', name: 'Browns River' },
  { id: 'u-cowichan-above', name: 'Cowichan River above the 66 Mile Trestle' }, { id: 'u-campbell-above', name: 'Campbell River above the Quinsam' },
  { id: 'u-puntledge-above', name: 'Puntledge River above Stotan Falls' }, { id: 'u-little-qualicum-above', name: 'Little Qualicum River above the falls' },
  { id: 'u-san-juan-above', name: 'San Juan River above the Fleet River' },
];
/** Every water on the map: listed stretches first, then unlisted rivers (rules: [], elsewhere: ZONE.r1). */
export const WATERS: Water[] = [
  ...LISTED,
  ...UNLISTED.map((u): Water => ({ id: u.id, name: u.name, rules: [], elsewhere: ZONE.r1, notes: u.note ? [u.note] : undefined })),
];

export const CITIES: City[] = [
  ['Victoria', -123.3656, 48.4284, 1], ['Nanaimo', -123.9401, 49.1659, 1], ['Campbell River', -125.2446, 50.0244, 1], ['Courtenay', -124.9904, 49.6877, 1],
  ['Port Alberni', -124.8055, 49.2339, 1], ['Duncan', -123.7079, 48.7787, 1], ['Port Hardy', -127.4199, 50.7231, 1], ['Tofino', -125.9066, 49.153, 1],
  ['Parksville', -124.3157, 49.3192, 2], ['Qualicum Beach', -124.4463, 49.3486, 2], ['Ladysmith', -123.8162, 48.9975, 2], ['Lake Cowichan', -124.053, 48.8253, 2],
  ['Port McNeill', -127.0858, 50.5876, 2], ['Gold River', -126.05, 49.7797, 2], ['Sooke', -123.726, 48.374, 2], ['Port Renfrew', -124.4214, 48.5547, 2],
  ['Sayward', -125.957, 50.3827, 2], ['Comox', -124.9283, 49.6735, 2], ['Ucluelet', -125.5466, 48.942, 2], ['Sidney', -123.3987, 48.6506, 2],
  ['Tahsis', -126.6586, 49.9192, 3], ['Zeballos', -126.846, 49.9811, 3], ['Holberg', -128.0075, 50.6464, 3], ['Woss', -126.6018, 50.2161, 3],
  ['Chemainus', -123.7175, 48.9253, 3], ['Cumberland', -125.0334, 49.6183, 3], ['Bamfield', -125.1358, 48.8338, 3], ['Youbou', -124.213, 48.878, 3],
  ['Cedar', -123.854, 49.112, 3], ['Coal Harbour', -127.5833, 50.598, 3], ['Alert Bay', -126.9259, 50.5869, 3], ['Port Alice', -127.49, 50.426, 3],
  ['Cowichan Bay', -123.62, 48.74, 3], ['Qualicum Bay', -124.615, 49.41, 3], ['Nitinat', -124.687, 48.76, 3], ['Tsawwassen', -123.0836, 49.0067, 3],
];
