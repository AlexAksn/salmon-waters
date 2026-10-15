// Source: DFO "Region 2 - Lower Mainland: Recreational salmon fishing limits, openings and closures"
// (url, page date and table hash live in ./source.json; scripts/check-dfo.mjs compares against it at build).
// Edit this file when DFO updates the page.  kind: keep = retention allowed | nr = non-retention
// (catch & release) | closed = no fishing for salmon | gear = gear rule.  from/to = "MM-DD" inclusive;
// to:null = until further notice.
import source from './source.json';

export type Species = 'chinook' | 'coho' | 'all';
export type RuleKind = 'keep' | 'nr' | 'closed' | 'gear';
export interface Rule { sp: Species; kind: RuleKind; from: string; to: string | null; limit?: string; notice?: string }
/** A water whose salmon rules are not on this page: tidal (Area 29) or simply not listed. */
export interface Elsewhere { status: 'tidal' | 'none'; short: string; text: string; link?: string }
export interface Water {
  id: string; name: string; sub?: string; group?: string; area?: string; notes?: string[];
  rules: Rule[]; lake?: string; elsewhere?: Elsewhere;
}
export type City = [name: string, lon: number, lat: number, rank: 1 | 2 | 3];

export const SOURCE_URL: string = source.url;
export const SOURCE_DATE: string = source.date;
export const NOTICES: Record<string, string> = {
  FN0960: 'https://notices.dfo-mpo.gc.ca/fns-sap/index-eng.cfm?pg=view_notice&DOC_ID=366086&ID=all',
  FN0961: 'https://notices.dfo-mpo.gc.ca/fns-sap/index-eng.cfm?pg=view_notice&DOC_ID=366093&ID=all',
  FN1008: 'https://notices.dfo-mpo.gc.ca/fns-sap/index-eng.cfm?pg=view_notice&DOC_ID=367431&ID=all',
};
export const GLOBAL_RULES: string[] = [
  'Salmon fishing in Region 2 is allowed during daylight hours only.',
  'No fishing within 100 m of any government facility used for counting, passing or rearing fish.',
  'Daily limit for all Pacific salmon, tidal and fresh waters combined: 4. Individual species limits also apply.',
  'Possession limit: twice the daily limit (max 8 salmon), except salmon at your ordinary residence.',
  'Annual limit: 10 chinook over 50 cm from all fresh waters combined.',
  'Squamish watershed: aggregate daily limit of hatchery-marked coho across all Squamish non-tidal systems is 1.',
  'Minimum sizes (nose to tail fork): coho 25 cm; chinook, chum, pink and sockeye 30 cm.',
  '"Adult chinook" is over 50 cm, except over 62 cm on the Fraser (Sep 1 to Dec 31), Chehalis (Sep 1 to Dec 31), Chilliwack/Vedder incl. Sumas, and Capilano.',
  'No salmon fishing in Region 2 waters flowing into Areas 28 and 29 except the listed opportunities. Waters flowing into Areas 13, 15 and 16: daily limit 0 unless listed.',
];
// Little Campbell River rules apply to both of its stretches; the lower reach adds a closure on top.
const LCR_RULES: Rule[] = [
  {sp:'chinook',kind:'keep',from:'08-15',to:'09-15',limit:'1 hatchery marked per day'},
  {sp:'chinook',kind:'nr',from:'09-16',to:'12-31'},
  {sp:'coho',kind:'nr',from:'08-15',to:'09-15'},
  {sp:'coho',kind:'keep',from:'09-16',to:'12-31',limit:'1 hatchery marked per day'},
];
/** Why an unlisted river has no salmon opportunity, by the DFO area its water flows into. */
export const ZONE: Record<'a2829' | 'a131516', Elsewhere> = {
  a2829: { status:'none', short:'No salmon fishing (flows to Area 28/29)', text:'Flows into Area 28 or 29: there is no salmon fishing except in listed waters. This water is not listed.' },
  a131516: { status:'none', short:'Daily limit 0 for salmon (flows to Area 13/15/16)', text:'Flows into Area 13, 15 or 16: the daily salmon limit is 0 unless the water is listed. It is not listed.' },
};
const LISTED: Water[] = [
  { id:'alouette-upper', name:'Alouette River', sub:'216 St bridge up to Allco Park', group:'Alouette River and tributaries',
    area:'Upstream of the 216th Street bridge to a line between two fishing boundary signs at Allco Park. Tributaries included.',
    rules:[
      {sp:'chinook',kind:'keep',from:'09-01',to:'11-30',limit:'1 per day'},
      {sp:'coho',kind:'nr',from:'09-01',to:'09-30'},
      {sp:'coho',kind:'keep',from:'10-01',to:'12-31',limit:'1 hatchery marked per day'},
    ]},
  { id:'alouette-lower', name:'Alouette River', sub:'216 St bridge down to the Pitt River', group:'Alouette River and tributaries',
    area:'Downstream of the 216th Street bridge to the confluence of the Pitt River.',
    rules:[
      {sp:'coho',kind:'keep',from:'10-01',to:'12-31',limit:'1 hatchery marked per day'},
    ]},
  { id:'north-alouette', name:'North Alouette River', sub:'and tributaries', group:'Alouette River and tributaries',
    area:'North Alouette River and tributaries.',
    rules:[
      {sp:'chinook',kind:'keep',from:'09-01',to:'11-30',limit:'1 per day'},
      {sp:'coho',kind:'nr',from:'09-01',to:'11-30'},
    ]},
  { id:'ashlu', name:'Ashlu Creek', sub:'Squamish watershed',
    area:'Ashlu Creek (tributary of the Squamish River).', notes:['Squamish watershed: 1 hatchery coho per day aggregate across all Squamish non-tidal systems.'],
    rules:[
      {sp:'all',kind:'gear',from:'04-01',to:'03-31',limit:'Bait ban'},
      {sp:'coho',kind:'keep',from:'09-15',to:'01-31',limit:'1 hatchery marked per day'},
    ]},
  { id:'capilano', name:'Capilano River', sub:'mouth to Cleveland Dam, incl. tributaries',
    area:'Capilano River including tributaries.', notes:['"Adult chinook" here means over 62 cm.'],
    rules:[
      {sp:'coho',kind:'keep',from:'04-01',to:'06-30',limit:'2 hatchery marked per day'},
      {sp:'coho',kind:'keep',from:'07-01',to:'03-31',limit:'4 hatchery marked per day'},
      {sp:'chinook',kind:'keep',from:'08-01',to:'09-04',limit:'4 per day, only 2 over 62 cm'},
      {sp:'chinook',kind:'keep',from:'09-05',to:'11-30',limit:'4 per day',notice:'FN0960'},
      {sp:'all',kind:'gear',from:'08-01',to:'10-31',limit:'Bait ban'},
    ]},
  { id:'chapman', name:'Chapman Creek', sub:'Hwy 101 bridge up to the falls',
    area:'Upstream of the tidal-water fishing boundary signs below the Hwy 101 bridge, to 100 m below the falls (the falls are about 550 m upstream of the powerline crossing).',
    rules:[
      {sp:'coho',kind:'keep',from:'04-01',to:'03-31',limit:'4 hatchery marked per day, only 2 over 35 cm'},
      {sp:'chinook',kind:'keep',from:'04-01',to:'03-31',limit:'4 per day, only 1 over 50 cm'},
    ]},
  { id:'cheakamus', name:'Cheakamus River', sub:'Squamish watershed',
    area:'Cheakamus River.', notes:['Squamish watershed: 1 hatchery coho per day aggregate across all Squamish non-tidal systems.'],
    rules:[
      {sp:'all',kind:'gear',from:'04-01',to:'03-31',limit:'Bait ban'},
      {sp:'coho',kind:'keep',from:'09-15',to:'01-31',limit:'1 per day, hatchery marked only'},
    ]},
  { id:'chehalis', name:'Chehalis River', sub:'below the logging bridge, incl. tributaries',
    area:'Downstream of the logging bridge 2.4 km downstream of Chehalis Lake, including tributaries to that part.', notes:['"Adult chinook" here means over 62 cm from Sep 1 to Dec 31.'],
    rules:[
      {sp:'chinook',kind:'keep',from:'06-01',to:'08-31',limit:'1 per day'},
      {sp:'chinook',kind:'keep',from:'09-01',to:'12-31',limit:'4 per day, only 1 over 62 cm'},
      {sp:'coho',kind:'nr',from:'06-01',to:'08-31'},
      {sp:'coho',kind:'keep',from:'09-01',to:'12-31',limit:'4 hatchery marked per day'},
    ]},
  { id:'chilliwack', name:'Chilliwack / Vedder River', sub:'incl. Sumas River below Barrowtown',
    area:'From a line between two fishing boundary signs 100 m downstream of the Chilliwack River / Slesse Creek confluence, downstream through the Vedder River and Vedder Canal, including the Sumas River from the Barrowtown Pump Station downstream to the fishing boundary signs near the Fraser River confluence.',
    notes:['"Adult chinook" here means over 62 cm.'],
    rules:[
      {sp:'chinook',kind:'keep',from:'07-01',to:'08-31',limit:'1 per day'},
      {sp:'chinook',kind:'keep',from:'09-01',to:'12-31',limit:'4 per day, only 2 over 62 cm'},
      {sp:'coho',kind:'nr',from:'07-01',to:'08-31'},
      {sp:'coho',kind:'keep',from:'09-01',to:'12-31',limit:'4 hatchery marked per day'},
    ]},
  { id:'coquitlam', name:'Coquitlam River', sub:'mouth to Coquitlam Dam',
    area:'Coquitlam River.',
    rules:[
      {sp:'chinook',kind:'keep',from:'09-05',to:'09-18',limit:'1 hatchery marked per day',notice:'FN0961'},
      {sp:'chinook',kind:'keep',from:'09-19',to:'12-31',limit:'1 per day',notice:'FN1008'},
      {sp:'coho',kind:'keep',from:'09-01',to:'12-31',limit:'1 hatchery marked per day'},
    ]},
  { id:'deboville', name:'De Boville Slough', sub:'below Cedar Creek / Hyde Creek',
    area:'Downstream of the confluence of Cedar Creek and Hyde Creek.',
    rules:[
      {sp:'coho',kind:'keep',from:'10-01',to:'12-31',limit:'1 hatchery marked per day'},
    ]},
  { id:'fraser-upper', name:'Fraser River', sub:'mainstem above the CPR bridge at Mission',
    area:'Mainstem waters upstream of the CPR Bridge at Mission.', notes:['"Adult chinook" here means over 62 cm from Sep 1 to Dec 31.'],
    rules:[
      {sp:'all',kind:'closed',from:'04-01',to:null,limit:'No fishing for salmon (until further notice)'},
    ]},
  { id:'fraser-tidal', name:'Fraser River', sub:'tidal waters below the CPR bridge at Mission', rules:[],
    area:'Below the CPR Bridge at Mission.',
    elsewhere:{ status:'tidal', short:'Managed under tidal (Area 29) rules', text:'This stretch is tidal water. Salmon rules come from the Area 29 tidal regulations, not this page.',
      link:'https://www.pac.dfo-mpo.gc.ca/fm-gp/rec/tidal-maree/a29-eng.html' } },
  { id:'harrison-upper', name:'Harrison River', sub:'Harrison Lake outlet to Hwy 7 bridge',
    area:'From the outlet of Harrison Lake downstream to the Highway 7 bridge.',
    rules:[
      {sp:'coho',kind:'keep',from:'09-01',to:'12-31',limit:'4 hatchery marked per day'},
    ]},
  { id:'harrison-lower', name:'Harrison River', sub:'Hwy 7 bridge to the Fraser',
    area:'From the Highway 7 bridge downstream to the confluence with the Fraser River.',
    rules:[
      {sp:'coho',kind:'keep',from:'09-01',to:'12-31',limit:'4 hatchery marked per day'},
    ]},
  { id:'kanaka', name:'Kanaka Creek', sub:'below the 112 Ave bridge',
    area:'Downstream of the 112th Street bridge.',
    rules:[
      {sp:'coho',kind:'keep',from:'11-01',to:'11-30',limit:'1 hatchery marked per day'},
    ]},
  { id:'khartoum', name:'Khartoum Lake', sub:'Powell River area', lake:'Khartoum Lake',
    area:'Khartoum Lake.',
    rules:[
      {sp:'all',kind:'gear',from:'04-01',to:'03-31',limit:'Single barbless hook'},
      {sp:'chinook',kind:'keep',from:'04-01',to:'03-31',limit:'4 per day'},
      {sp:'coho',kind:'keep',from:'04-01',to:'03-31',limit:'4 per day'},
    ]},
  { id:'lcr', name:'Little Campbell River', sub:'below 12 Ave, incl. tributaries',
    area:'Downstream of 12th Avenue, including tributaries to that part.', rules:LCR_RULES },
  { id:'lcr-mouth', name:'Little Campbell River', sub:'lower reach to the Stayte Rd footbridge',
    area:'Downstream of a line between two fishing boundary signs on either side of the river, to the pedestrian bridge at the foot of Stayte Road. Otherwise the "below 12 Ave" rules apply.',
    rules:[ {sp:'all',kind:'closed',from:'08-15',to:'09-30',limit:'No fishing for salmon'}, ...LCR_RULES ] },
  { id:'lois', name:'Lois Lake', sub:'Powell River area', lake:'Lois Lake',
    area:'Lois Lake.',
    rules:[
      {sp:'all',kind:'gear',from:'04-01',to:'03-31',limit:'Single barbless hook'},
      {sp:'chinook',kind:'keep',from:'04-01',to:'03-31',limit:'4 per day'},
      {sp:'coho',kind:'keep',from:'04-01',to:'03-31',limit:'4 per day'},
    ]},
  { id:'mamquam', name:'Mamquam River', sub:'Squamish watershed',
    area:'Mamquam River.', notes:['Squamish watershed: 1 hatchery coho per day aggregate across all Squamish non-tidal systems.'],
    rules:[
      {sp:'all',kind:'gear',from:'04-01',to:'03-31',limit:'Bait ban'},
      {sp:'coho',kind:'keep',from:'09-15',to:'01-31',limit:'1 per day, hatchery marked only'},
    ]},
  { id:'nicomekl', name:'Nicomekl River', sub:'below 208 St',
    area:'Downstream of 208th Street.',
    rules:[
      {sp:'chinook',kind:'keep',from:'09-01',to:'11-30',limit:'1 per day'},
      {sp:'chinook',kind:'nr',from:'12-01',to:'12-31'},
      {sp:'coho',kind:'keep',from:'09-01',to:'12-31',limit:'1 hatchery marked per day'},
    ]},
  { id:'nicomen', name:'Nicomen (Dewdney) Slough', sub:'Siddle Creek down to the Fraser',
    area:'From the confluence of Siddle (Bell’s) Creek downstream to the Fraser River.',
    rules:[
      {sp:'coho',kind:'keep',from:'09-01',to:'12-31',limit:'4 hatchery marked per day, only 2 over 35 cm'},
    ]},
  { id:'norrish', name:'Norrish (Suicide) Creek', sub:'near Dewdney',
    area:'Norrish (Suicide) Creek.',
    rules:[
      {sp:'coho',kind:'keep',from:'09-01',to:'12-31',limit:'4 hatchery marked per day, only 2 over 35 cm'},
    ]},
  { id:'serpentine', name:'Serpentine River', sub:'below 168 St at Bothwell Park',
    area:'Downstream of 168th Street at Bothwell Park.',
    rules:[
      {sp:'chinook',kind:'keep',from:'09-01',to:'11-30',limit:'1 per day'},
      {sp:'chinook',kind:'nr',from:'12-01',to:'12-31'},
      {sp:'coho',kind:'keep',from:'09-01',to:'12-31',limit:'1 hatchery marked per day'},
    ]},
  { id:'squamish', name:'Squamish River', sub:'incl. Powerhouse Channel',
    area:'Squamish River including the Powerhouse Channel.', notes:['Squamish watershed: 1 hatchery coho per day aggregate across all Squamish non-tidal systems.'],
    rules:[
      {sp:'all',kind:'gear',from:'04-01',to:'03-31',limit:'Bait ban'},
      {sp:'coho',kind:'keep',from:'09-15',to:'01-31',limit:'1 per day, hatchery marked only'},
    ]},
  { id:'stave', name:'Stave River', sub:'Ruskin Dam to the CPR bridge',
    area:'Downstream of the BC Hydro dam to the CPR railway bridge. Closed to salmon fishing: the Ruskin Spawning Channel (east bank, from the inlet near the dam to the boat-ramp crossing) and the Northrop Spawning Channel (west side, from the intake to where it rejoins the mainstem, including its fishway tributary).',
    rules:[
      {sp:'coho',kind:'keep',from:'09-01',to:'12-31',limit:'4 hatchery marked per day, only 2 over 35 cm'},
    ]},
];
// Rivers with no listed salmon opportunity (shown thin grey so the answer "no" is visible on the map)
export const UNLISTED: { id: string; name: string; zone: keyof typeof ZONE; note?: string }[] = [
  {id:'u-pitt',name:'Pitt River',zone:'a2829'},{id:'u-lillooet',name:'Lillooet River',zone:'a2829'},{id:'u-seymour',name:'Seymour River',zone:'a2829'},
  {id:'u-indian',name:'Indian River',zone:'a2829'},{id:'u-lynn',name:'Lynn Creek',zone:'a2829'},{id:'u-coquihalla',name:'Coquihalla River',zone:'a2829'},
  {id:'u-silverhope',name:'Silverhope Creek',zone:'a2829'},{id:'u-salmon',name:'Salmon River (Langley)',zone:'a2829'},{id:'u-brunette',name:'Brunette River',zone:'a2829'},
  {id:'u-lois',name:'Lois River',zone:'a131516'},{id:'u-powell',name:'Powell River',zone:'a131516'},{id:'u-elaho',name:'Elaho River',zone:'a2829'},
  {id:'u-alouette-above',name:'Alouette River above Allco Park',zone:'a2829'},{id:'u-chilliwack-above',name:'Chilliwack River above Slesse Creek',zone:'a2829'},
  {id:'u-chehalis-above',name:'Chehalis River above the logging bridge',zone:'a2829'},{id:'u-cheakamus-above',name:'Cheakamus River above Daisy Lake',zone:'a2829',note:'Listed as Cheakamus River; shown separately above the dam.'},
  {id:'u-kanaka-above',name:'Kanaka Creek above 112 Ave',zone:'a2829'},{id:'u-nicomekl-above',name:'Nicomekl River above 208 St',zone:'a2829'},
  {id:'u-serpentine-above',name:'Serpentine River above 168 St',zone:'a2829'},{id:'u-lcr-above',name:'Little Campbell River above 12 Ave',zone:'a2829'},
  {id:'u-sumas-above',name:'Sumas River above Barrowtown',zone:'a2829'},{id:'u-norrish-above',name:'Norrish Creek (upper)',zone:'a2829'},
  {id:'u-stave-above',name:'Stave River above Ruskin Dam',zone:'a2829'},{id:'u-slesse',name:'Slesse Creek',zone:'a2829'},
];
/** Every water on the map: listed stretches first, then unlisted rivers (rules: [], elsewhere: ZONE[...]). */
export const WATERS: Water[] = [
  ...LISTED,
  ...UNLISTED.map((u): Water => ({ id: u.id, name: u.name, rules: [], elsewhere: ZONE[u.zone], notes: u.note ? [u.note] : undefined })),
];

export const CITIES: City[] = [
  ['Vancouver',-123.1139,49.2611,1],['Surrey',-122.8501,49.1916,1],['Abbotsford',-122.3292,49.0522,1],['Chilliwack',-121.9508,49.1578,1],
  ['Squamish',-123.1558,49.6981,1],['Powell River',-124.5244,49.8356,1],['Sechelt',-123.7633,49.4717,1],['Hope',-121.4414,49.38,1],
  ['Maple Ridge',-122.5989,49.22,2],['Mission',-122.3167,49.1403,2],['Langley',-122.6591,49.1045,2],['Coquitlam',-122.7936,49.2842,2],
  ['North Vancouver',-123.0739,49.3206,2],['Richmond',-123.1375,49.163,2],['Delta',-123.0586,49.0847,2],['White Rock',-122.7983,49.0236,2],
  ['Gibsons',-123.5089,49.4003,2],['Harrison Hot Springs',-121.7844,49.2989,2],['Agassiz',-121.7679,49.2331,2],['Whistler',-122.9547,50.1172,2],
  ['Pitt Meadows',-122.6903,49.2206,3],['Port Coquitlam',-122.7803,49.2619,3],['Harrison Mills',-121.9492,49.2605,3],['Deroche',-122.0679,49.1831,3],
  ['Dewdney',-122.1964,49.1649,3],['Ruskin',-122.4353,49.1984,3],['Vedder Crossing',-121.9626,49.1023,3],['Yarrow',-122.0496,49.0826,3],
  ['Brackendale',-123.1513,49.7665,3],['Lions Bay',-123.2353,49.4586,3],['Madeira Park',-124.0233,49.6205,3],['Saltery Bay',-124.1791,49.7832,3],
  ['Stillwater',-124.3018,49.7644,3],['Lake Errock',-122.0114,49.2202,3],['Stave Falls',-122.3578,49.2289,3],['Hatzic',-122.2513,49.1498,3],
];
