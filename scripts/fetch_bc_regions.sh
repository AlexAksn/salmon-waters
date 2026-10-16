#!/usr/bin/env bash
# Downloads BC's wildlife management units (the freshwater fishing regions are their first number) into raw/bc/mu.json
# (gitignored, ~60 MB), then dissolves them into public/data/bc-regions.json for the overview page.
# Source: BC Data Catalogue WFS (Open Government Licence – BC). Usage: scripts/fetch_bc_regions.sh
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p raw/bc
curl -s -m 900 --get "https://openmaps.gov.bc.ca/geo/pub/wfs" --data-urlencode "service=WFS" --data-urlencode "version=2.0.0" --data-urlencode "request=GetFeature" \
  --data-urlencode "typeName=WHSE_WILDLIFE_MANAGEMENT.WAA_WILDLIFE_MGMT_UNITS_SVW" --data-urlencode "outputFormat=json" --data-urlencode "srsName=EPSG:4326" \
  --data-urlencode "propertyName=WILDLIFE_MGMT_UNIT_ID,REGION_RESPONSIBLE,REGION_RESPONSIBLE_NAME,GEOMETRY" -o raw/bc/mu.json
echo "mu.json: $(wc -c < raw/bc/mu.json) bytes"
python3 -I scripts/bc-regions.py raw/bc/mu.json public/data/bc-regions.json
