# Salmon Waters — BC freshwater salmon regs on a map (DFO Regions 1 and 2)

> **Not an official source.** This is a hobby project that re-presents Fisheries and Oceans Canada's published
> regulations. Rules are transcribed by hand and can be wrong or out of date; boundary points are approximate;
> river data is provisional. Always confirm with the [DFO page](https://www.pac.dfo-mpo.gc.ca/fm-gp/rec/fresh-douce/region2-eng.html),
> current fishery notices and on-site signs before you fish. Live site: https://salmonwaters.ca/

"Can I fish for salmon here, right now?" — an interactive map of the freshwater salmon openings, closures and
boundaries published by DFO for Region 2 (Lower Mainland) and Region 1 (Vancouver Island):
https://www.pac.dfo-mpo.gc.ca/fm-gp/rec/fresh-douce/region2-eng.html

- Every regulated stretch is coloured by its status for the chosen **date + species**: open / catch & release / closed / not listed / tidal.
- Tap a river → plain-English rules for that day, season strip, boundary points, full season table, fishery-notice links.
- "Changing soon" is derived from the rules (what opens/closes in the next 45 days).
- Sort by nearest town or **your location**; shareable URLs (`?d=2026-11-01&sp=coho&w=kanaka&b=topo`).
- Basemaps: built-in offline-capable **Chart** (BC open data) plus Streets / Topo / Satellite tiles.
- **River conditions**: live flow/level, 24 h trend and 72 h chart from Environment Canada gauges on 16 waters, with
  "low / normal / high for this month" context from the long-term HYDAT monthly means.
- **Stale-rules warning**: the build records the DFO page's date + a hash of its table; the app shows a banner if DFO
  changed the page after the rules were transcribed.
- **Fishery notices**: every build pulls the last ~6 weeks of DFO Pacific notices and keeps the recreational-salmon ones
  for Region 2 / our rivers. They show as a strip, a badge on the affected water, in its detail view, and in the banner
  when newer than two weeks — notices usually land before the regulations page is edited.
- **Installable**: web app manifest for add-to-home-screen; no service worker, nothing is cached offline.

## Stack
Vite + React 18 + TypeScript + Leaflet. Static output — no backend.

```sh
npm install
npm run dev        # http://localhost:5173
npm test           # rule-engine unit tests (vitest)
npm run build      # -> dist/
```

## Deploy (free: GitHub Pages + Actions)
`.github/workflows/deploy.yml` builds and deploys on every push to `main`, and every 3 h on a schedule so the
DFO freshness check and notice pull (`prebuild`) stay current. Nothing runs server-side.

```sh
gh repo create salmon-waters --public --source . --push      # or private; Pages is free either way
gh api repos/{owner}/salmon-waters/pages -X POST -f build_type=workflow   # Pages source = GitHub Actions
```
The site is served at the custom domain in `public/CNAME` (salmonwaters.ca; GitHub redirects the old
`alexaksn.github.io/salmon-waters/` links there). For a fork without a domain, delete `public/CNAME` and pass
`BASE_PATH: /<repo>/` to the build step in the workflow so assets resolve under the sub-path.

Any other static host works too (`npm run build` → `dist/`); only the scheduled freshness check is GitHub-specific.
Optional `.env`: `VITE_MAPTILER_KEY=…` switches Streets/Topo/Satellite to MapTiler (the default public OSM /
OpenTopoMap / Esri tile servers are fine for personal use, not for heavy traffic).

## Layout
Rules and geometry are partitioned by DFO region: everything specific to one region lives in `src/regions/<id>/`
and `public/data/<id>/`; the engine, map and UI are shared. Regions so far: r2 Lower Mainland, r1 Vancouver Island.
```
src/regions/model.ts        data model every region shares: Rule/Water types, species registry (chinook, coho, chum,
                            pink, sockeye) — a rule naming a new species adds its chip/strip row automatically
src/regions/index.ts        region registry (id, name, DFO page, home view, lazy loader); the first entry is the default
src/regions/r2/regs.ts      Region 2 rules table transcribed from the DFO page — edit this when DFO changes the page
src/regions/r2/region.json  DFO page url, date and table hash the rules came from (check-dfo compares), notice patterns
src/regions/r2/gauges.ts    water id -> ECCC station; edit to add/replace gauges, then `npm run data:stations`
src/regions/r2/stations.json  generated: station coordinates (-> one bbox request for all cards) + HYDAT monthly means
src/regions/r2/geo.json     geometry pipeline inputs: bbox, FWA stream names, roads, rail, boundary probes
src/regions/r2/waters.py    build/r2/stems -> waters.json (centreline slice per stretch + markers; measures by hand)
src/lib/rules.ts      status engine (date windows incl. wrap-around + "until further notice", season runs, upcoming changes)
src/lib/region.ts     the loaded region as React context (useRegion) + makeRegion
src/lib/map.ts        Leaflet controller (per-pane canvases, merged vector base, tile basemaps, status painting, markers)
src/lib/geo.ts        geometry types + distance helpers
src/lib/flow.ts       ECCC hydrometric API client (one bbox request per region for the cards, per station for the chart), trend + "vs typical" logic
src/components/       Header, MapView, Panel (list/detail), WaterCard, WaterDetail, SeasonStrip, ChangingSoon
public/data/r2/base.json    vector basemap: land, lakes, river polygons, highways, secondary roads, rail (~2 MB)
public/data/r2/waters.json  river centreline slice per regulated stretch + boundary markers (~200 KB)
scripts/fetch_raw.sh      download a region's raw layers (per its geo.json) from BC Data Catalogue WFS into raw/<id>/
scripts/geomlib.py        shared geometry helpers (simplify, clip, stem slicing, projection)
scripts/geo.py            raw/<id>/ -> build/<id>/base.json (+ stems); `--boundaries` prints bridge/rail × river crossings
scripts/build-geo.sh      geo.py + the region's waters.py -> public/data/<id>/
scripts/regions.mjs       lists src/regions/*/region.json for the build scripts
scripts/bc-regions.py     wildlife management units -> public/data/bc-regions.json (topological dissolve, one ring per region)
src/components/Overview.tsx  BC overview page: region outlines coloured by today's counts; unmapped regions as stubs (src/regions/index.ts)
scripts/check-dfo.mjs     prebuild: per region, fetch its DFO page -> public/data/<id>/dfo-status.json (date + table hash)
scripts/fetch-notices.mjs prebuild: DFO notice search pages -> public/data/<id>/notices.json (regex-matched to water ids)
scripts/stations.mjs      gauges.ts -> src/regions/<id>/stations.json (station coordinates, bbox, HYDAT monthly means); rerun yearly
```
Regenerate geometry: `npm run data:raw -- r2 && npm run data:geo -- r2`. Region outlines for the BC overview page
(`public/data/bc-regions.json`, dissolved from BC's wildlife management units): `npm run data:regions`.

Adding a region: copy `src/regions/r2/` to `src/regions/<id>/`, transcribe that region's DFO table into `regs.ts`, fill
`region.json` (page, hash, notice patterns) and `geo.json` (bbox, stream names), run the two data commands, and add the
entry to `src/regions/index.ts` (and drop its stub there). `?r=<id>` opens it; the bare URL (or the brand) is the overview.

## Status logic
closed rule active → **Closed**; else a retention rule for the species → **Open**; else a non-retention rule → **Catch & release**;
else **Not listed**. Species "Any" = open if any species can be kept. Species are data: the "I want" chips show every
species that has at least one rule, and each water's season strip shows the species with rules on that water.

## Caveats
- Not an official source. Boundary markers flagged *approximate* were placed from the written description, not surveyed.
- Fraser below the Mission CPR bridge is tidal (Area 29) and intentionally not modelled.
- Fishery notices are surfaced and linked, not parsed into rules: the app cannot tell that "refrain from fishing"
  means closed. In-season changes still require editing `regs.ts`; the banner tells you *that* something changed.
- Gauge readings are provisional ECCC data and sit at the station, not necessarily at your spot on the river.
- Prototype (single-file artifact): https://claude.ai/artifact/YP7QNSB15LRdFjHfj2m5X4

## License
Code: [MIT](LICENSE). Regulations text © Fisheries and Oceans Canada (reproduced for reference). Base map data:
BC Freshwater Atlas, Digital Road Atlas, NTS coastline under the [Open Government Licence – British Columbia](https://www2.gov.bc.ca/gov/content/data/policy-standards/open-data/open-government-licence-bc);
hydrometric data: Environment and Climate Change Canada under the [Open Government Licence – Canada](https://open.canada.ca/en/open-government-licence-canada).
