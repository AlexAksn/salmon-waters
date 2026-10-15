# Salmon Waters — Lower Mainland (DFO Region 2)

> **Not an official source.** This is a hobby project that re-presents Fisheries and Oceans Canada's published
> regulations. Rules are transcribed by hand and can be wrong or out of date; boundary points are approximate;
> river data is provisional. Always confirm with the [DFO page](https://www.pac.dfo-mpo.gc.ca/fm-gp/rec/fresh-douce/region2-eng.html),
> current fishery notices and on-site signs before you fish. Live site: https://alexaksn.github.io/salmon-waters/

"Can I fish for salmon here, right now?" — an interactive map of the freshwater salmon openings, closures and
boundaries published by DFO for Region 2 (Lower Mainland):
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
- **Installable PWA**: app shell, rules and the Chart basemap are precached; gauge data and tiles are cached on use.

## Stack
Vite + React 18 + TypeScript + Leaflet. Static output — no backend.

```sh
npm install
npm run dev        # http://localhost:5173
npm test           # rule-engine unit tests (vitest)
npm run build      # -> dist/
```

## Deploy (free: GitHub Pages + Actions)
`.github/workflows/deploy.yml` builds and deploys on every push to `main`, and every 6 h on a schedule so the
DFO freshness check (`prebuild`) stays current. Nothing runs server-side.

```sh
gh repo create salmon-waters --public --source . --push      # or private; Pages is free either way
gh api repos/{owner}/salmon-waters/pages -X POST -f build_type=workflow   # Pages source = GitHub Actions
```
The site appears at `https://<you>.github.io/salmon-waters/` after the first run (Actions tab). The workflow sets
`BASE_PATH` from the repo name, so assets resolve under the sub-path; a custom domain or `<you>.github.io` repo needs no change.

Any other static host works too (`npm run build` → `dist/`); only the scheduled freshness check is GitHub-specific.
Optional `.env`: `VITE_MAPTILER_KEY=…` switches Streets/Topo/Satellite to MapTiler (the default public OSM /
OpenTopoMap / Esri tile servers are fine for personal use, not for heavy traffic).

## Layout
```
src/data/regs.ts      rules table transcribed from the DFO page — edit this when DFO changes the page
src/data/source.json  DFO page url, date and table hash the rules were transcribed from (check-dfo compares against it)
src/lib/rules.ts      status engine (date windows incl. wrap-around + "until further notice", season runs, upcoming changes)
src/lib/map.ts        Leaflet controller (per-pane canvases, merged vector base, tile basemaps, status painting, markers)
src/lib/geo.ts        geometry types + distance helpers
src/lib/flow.ts       ECCC hydrometric API client (realtime + HYDAT monthly means), trend + "vs typical" logic
src/data/gauges.ts    water id -> ECCC station; edit to add/replace gauges
src/components/       Header, MapView, Panel (list/detail), WaterCard, WaterDetail, SeasonStrip, ChangingSoon
public/data/base.json     vector basemap: land, lakes, river polygons, highways, secondary roads, rail (~1 MB)
public/data/waters.json   river centreline slice per regulated stretch + boundary markers (~200 KB)
scripts/fetch_raw.sh      download raw layers from BC Data Catalogue WFS into raw/
scripts/geomlib.py        shared geometry helpers (simplify, clip, stem slicing, projection)
scripts/geo.py            raw/ -> build/base.json (+ stems); `--boundaries` prints bridge/rail × river crossings
scripts/waters.py         build/stems -> build/waters.json (segment slices + markers)
scripts/check-dfo.mjs     prebuild: fetch DFO page -> public/data/dfo-status.json (date + table hash)
```
Regenerate geometry: `scripts/fetch_raw.sh && npm run data:geo`.

## Status logic
closed rule active → **Closed**; else a retention rule for the species → **Open**; else a non-retention rule → **Catch & release**;
else **Not listed**. Species "Any" = open if either chinook or coho can be kept.

## Caveats
- Not an official source. Boundary markers flagged *approximate* were placed from the written description, not surveyed.
- Fraser below the Mission CPR bridge is tidal (Area 29) and intentionally not modelled.
- Fishery notices (FN0960 / FN0961 / FN1008) are linked, not parsed (DFO offers no feed); in-season changes require
  editing `regs.ts`. The stale-rules banner only tells you *that* the page changed, not what.
- Gauge readings are provisional ECCC data and sit at the station, not necessarily at your spot on the river.
- Prototype (single-file artifact): https://claude.ai/artifact/YP7QNSB15LRdFjHfj2m5X4

## License
Code: [MIT](LICENSE). Regulations text © Fisheries and Oceans Canada (reproduced for reference). Base map data:
BC Freshwater Atlas, Digital Road Atlas, NTS coastline under the [Open Government Licence – British Columbia](https://www2.gov.bc.ca/gov/content/data/policy-standards/open-data/open-government-licence-bc);
hydrometric data: Environment and Climate Change Canada under the [Open Government Licence – Canada](https://open.canada.ca/en/open-government-licence-canada).
