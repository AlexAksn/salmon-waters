#!/usr/bin/env bash
# Downloads the raw open-data layers for one region into raw/<region>/ (gitignored). What to fetch (bbox, stream
# names, roads, rail) is listed in src/regions/<region>/geo.json. Source: BC Data Catalogue WFS (Open Government
# Licence – British Columbia). Takes a few minutes.
# Usage: scripts/fetch_raw.sh [region=r2]        DRY=1 prints the requests instead of running them.
set -euo pipefail
cd "$(dirname "$0")/.."
REG=${1:-r2}; CFG="$PWD/src/regions/$REG/geo.json"; [ -f "$CFG" ] || { echo "no $CFG" >&2; exit 1; }
mkdir -p "raw/$REG"; cd "raw/$REG"
WFS="https://openmaps.gov.bc.ca/geo/pub/wfs"
# cfg <dotted.key>: a list prints comma-joined (strings SQL-quoted), a scalar prints as is
cfg() { python3 -I - "$CFG" "$1" <<'PY'
import json, sys
v = json.load(open(sys.argv[1]))
for k in sys.argv[2].split('.'): v = v[int(k)] if isinstance(v, list) else v[k]
print(','.join("'" + x.replace("'", "''") + "'" if isinstance(x, str) else str(x) for x in v) if isinstance(v, list) else v)
PY
}
BB=$(cfg bbox)
get() { # name typeName propertyName cql
  if [ -n "${DRY:-}" ]; then echo "$1 <- $2 [$3] WHERE $4"; return; fi
  curl -s -m 600 --get "$WFS" --data-urlencode "service=WFS" --data-urlencode "version=2.0.0" --data-urlencode "request=GetFeature" \
    --data-urlencode "typeName=$2" --data-urlencode "outputFormat=json" --data-urlencode "srsName=EPSG:4326" \
    ${3:+--data-urlencode "propertyName=$3"} --data-urlencode "CQL_FILTER=$4" -o "$1.json"; echo "$1: $(wc -c < "$1.json") bytes"; }
if [ -n "${DRY:-}" ]; then echo "coast <- NTS_BC_COASTLINE_POLYS_125M bbox=$BB"; else
  curl -s -m 600 "$WFS?service=WFS&version=2.0.0&request=GetFeature&typeName=WHSE_BASEMAPPING.NTS_BC_COASTLINE_POLYS_125M&outputFormat=json&srsName=EPSG:4326&bbox=$BB,EPSG:4326" -o coast.json; echo "coast: $(wc -c < coast.json) bytes"; fi
get lakes WHSE_BASEMAPPING.FWA_LAKES_POLY "GNIS_NAME_1,AREA_HA,GEOMETRY" "BBOX(GEOMETRY,$BB,'EPSG:4326') AND AREA_HA>40"
get rivers_poly WHSE_BASEMAPPING.FWA_RIVERS_POLY "GNIS_NAME_1,AREA_HA,GEOMETRY" "BBOX(GEOMETRY,$BB,'EPSG:4326')"
STREAM_PROPS="GNIS_NAME,BLUE_LINE_KEY,STREAM_ORDER,DOWNSTREAM_ROUTE_MEASURE,LENGTH_METRE,WATERSHED_GROUP_CODE,EDGE_TYPE,GEOMETRY"
get streams WHSE_BASEMAPPING.FWA_STREAM_NETWORKS_SP "$STREAM_PROPS" "BBOX(GEOMETRY,$BB,'EPSG:4326') AND GNIS_NAME IN ($(cfg streams))"
# Streams the FWA names differently from DFO: fetched by LIKE inside a small bbox and merged under the DFO name below
N=$(python3 -I -c "import json,sys; print(len(json.load(open(sys.argv[1])).get('aliases', [])))" "$CFG")
for ((i = 0; i < N; i++)); do
  get "alias$i" WHSE_BASEMAPPING.FWA_STREAM_NETWORKS_SP "$STREAM_PROPS" "BBOX(GEOMETRY,$(cfg aliases.$i.bbox),'EPSG:4326') AND GNIS_NAME LIKE '$(cfg aliases.$i.like)'"
done
get roads WHSE_BASEMAPPING.DRA_DGTL_ROAD_ATLAS_MPAR_SP "ROAD_NAME_FULL,ROAD_CLASS,HIGHWAY_ROUTE_NUMBER,GEOMETRY" "BBOX(GEOMETRY,$BB,'EPSG:4326') AND ROAD_CLASS IN ('freeway','highway')"
get roads2 WHSE_BASEMAPPING.DRA_DGTL_ROAD_ATLAS_MPAR_SP "ROAD_NAME_FULL,ROAD_CLASS,GEOMETRY" "BBOX(GEOMETRY,$(cfg roads.bbox),'EPSG:4326') AND ROAD_NAME_FULL IN ($(cfg roads.named))"
get bridges_roads WHSE_BASEMAPPING.DRA_DGTL_ROAD_ATLAS_MPAR_SP "ROAD_NAME_FULL,ROAD_CLASS,GEOMETRY" "BBOX(GEOMETRY,$(cfg bridgeRoads.bbox),'EPSG:4326') AND ROAD_NAME_FULL IN ($(cfg bridgeRoads.named))"
RC=$(cfg rail.classes 2>/dev/null || echo "'Main'")
get rail WHSE_BASEMAPPING.GBA_RAILWAY_TRACKS_SP "" "BBOX(SHAPE,$(cfg rail.bbox),'EPSG:4326') AND TRACK_CLASSIFICATION IN ($RC)"
[ -n "${DRY:-}" ] && exit 0
python3 -I - "$CFG" <<'PY'
import json, sys
cfg = json.load(open(sys.argv[1]))
s = json.load(open('streams.json')); have = {f['id'] for f in s['features']}
for i, a in enumerate(cfg.get('aliases', [])):
    for f in json.load(open(f'alias{i}.json'))['features']:
        if f['id'] not in have: f['properties']['GNIS_NAME'] = a['name']; s['features'].append(f); have.add(f['id'])
json.dump(s, open('streams.json', 'w')); print('streams merged', len(s['features']))
PY
echo "done. next: scripts/build-geo.sh $REG"
