#!/usr/bin/env bash
# Downloads the raw open-data layers used to build public/data/*.json into ./raw (gitignored).
# Source: BC Data Catalogue WFS (Open Government Licence – British Columbia). Takes a few minutes.
set -euo pipefail
cd "$(dirname "$0")/.."; mkdir -p raw; cd raw
WFS="https://openmaps.gov.bc.ca/geo/pub/wfs"
BB="-125.6,48.2,-120.6,50.8"
get() { # name typeName propertyName cql
  curl -s -m 600 --get "$WFS" --data-urlencode "service=WFS" --data-urlencode "version=2.0.0" --data-urlencode "request=GetFeature" \
    --data-urlencode "typeName=$2" --data-urlencode "outputFormat=json" --data-urlencode "srsName=EPSG:4326" \
    ${3:+--data-urlencode "propertyName=$3"} --data-urlencode "CQL_FILTER=$4" -o "$1.json"; echo "$1: $(wc -c < "$1.json") bytes"; }
curl -s -m 600 "$WFS?service=WFS&version=2.0.0&request=GetFeature&typeName=WHSE_BASEMAPPING.NTS_BC_COASTLINE_POLYS_125M&outputFormat=json&srsName=EPSG:4326&bbox=$BB,EPSG:4326" -o coast.json; echo "coast: $(wc -c < coast.json) bytes"
get lakes WHSE_BASEMAPPING.FWA_LAKES_POLY "GNIS_NAME_1,AREA_HA,GEOMETRY" "BBOX(GEOMETRY,$BB,'EPSG:4326') AND AREA_HA>40"
get rivers_poly WHSE_BASEMAPPING.FWA_RIVERS_POLY "GNIS_NAME_1,AREA_HA,GEOMETRY" "BBOX(GEOMETRY,$BB,'EPSG:4326')"
NAMES="'Alouette River','North Alouette River','Ashlu Creek','Capilano River','Chapman Creek','Cheakamus River','Chehalis River','Chilliwack River','Vedder River','Sumas River','Coquitlam River','De Boville Slough','Fraser River','Harrison River','Kanaka Creek','Mamquam River','Nicomekl River','Nicomen Slough','Norrish Creek','Serpentine River','Squamish River','Stave River','Slesse Creek','Hyde Creek','Pitt River','Lillooet River','Elaho River','Lois River','Powell River','Seymour River','Indian River','Lynn Creek','Brunette River','Salmon River','Coquihalla River','Silverhope Creek','Chilqua Slough'"
get streams WHSE_BASEMAPPING.FWA_STREAM_NETWORKS_SP "GNIS_NAME,BLUE_LINE_KEY,STREAM_ORDER,DOWNSTREAM_ROUTE_MEASURE,LENGTH_METRE,WATERSHED_GROUP_CODE,EDGE_TYPE,GEOMETRY" "BBOX(GEOMETRY,$BB,'EPSG:4326') AND GNIS_NAME IN ($NAMES)"
# Little Campbell River is 'Campbell River' in FWA; merged + renamed by geo.py's caller
get lcr WHSE_BASEMAPPING.FWA_STREAM_NETWORKS_SP "GNIS_NAME,BLUE_LINE_KEY,STREAM_ORDER,DOWNSTREAM_ROUTE_MEASURE,LENGTH_METRE,WATERSHED_GROUP_CODE,EDGE_TYPE,GEOMETRY" "BBOX(GEOMETRY,-122.85,48.99,-122.55,49.09,'EPSG:4326') AND GNIS_NAME LIKE '%Campbell%'"
get roads WHSE_BASEMAPPING.DRA_DGTL_ROAD_ATLAS_MPAR_SP "ROAD_NAME_FULL,ROAD_CLASS,HIGHWAY_ROUTE_NUMBER,GEOMETRY" "BBOX(GEOMETRY,$BB,'EPSG:4326') AND ROAD_CLASS IN ('freeway','highway')"
get roads2 WHSE_BASEMAPPING.DRA_DGTL_ROAD_ATLAS_MPAR_SP "ROAD_NAME_FULL,ROAD_CLASS,GEOMETRY" "BBOX(GEOMETRY,-124.9,49.0,-121.3,50.0,'EPSG:4326') AND ROAD_NAME_FULL IN ('Sunshine Coast Hwy','Hwy 101','Squamish Valley Rd','Government Rd','Chilliwack Lake Rd','Morris Valley Rd','Chehalis FSR','Dewdney Trunk Rd','Hayward St','Wilson Rd','Hwy 7','Hwy 1','Hwy 99','Hwy 11','Hwy 9','Lougheed Hwy','Trans-Canada Hwy','Dixon Rd','Nicomen Island Trunk Rd','Vedder Rd','Keith Wilson Rd','Vedder Mountain Rd','No 3 Rd','Sumas Prairie Rd','Pipeline Rd','Shaughnessy St','Coast Meridian Rd','Victoria Dr','Cedar Dr','Lillooet Rd','Dollarton Hwy','Mamquam Rd','Paradise Valley Rd','Field Rd','Brooks Rd','King George Blvd','Marine Dr','Stave Lake St','Alouette Rd','Fern Cres','232 St','240 St','Crown St','Hurd St','Horne St','Stave Lake Rd','Oyama St','Railway Ave','Riverside St')"
get bridges_roads WHSE_BASEMAPPING.DRA_DGTL_ROAD_ATLAS_MPAR_SP "ROAD_NAME_FULL,ROAD_CLASS,GEOMETRY" "BBOX(GEOMETRY,-123.0,49.0,-122.2,49.35,'EPSG:4326') AND ROAD_NAME_FULL IN ('216 St','208 St','168 St','12 Ave','112 Ave','Stayte Rd','Alouette Rd','Lougheed Hwy','Trans-Canada Hwy','Dewdney Trunk Rd','Hayward St','Stave Lake St','Kanaka Way','Marine Dr','Capilano Rd','Burke Mountain St')"
get rail WHSE_BASEMAPPING.GBA_RAILWAY_TRACKS_SP "" "BBOX(SHAPE,-123.3,49.0,-121.3,49.45,'EPSG:4326') AND TRACK_CLASSIFICATION='Main'"
# merge Little Campbell into streams under its DFO name
python3 -I - <<'PY'
import json
s=json.load(open('streams.json')); l=json.load(open('lcr.json')); have={f['id'] for f in s['features']}
for f in l['features']:
    if f['id'] not in have: f['properties']['GNIS_NAME']='Little Campbell River'; s['features'].append(f)
json.dump(s,open('streams.json','w')); print('streams merged', len(s['features']))
PY
echo "done. next: npm run data:geo"
