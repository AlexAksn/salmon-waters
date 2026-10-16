#!/usr/bin/env bash
# raw/<region>/ -> build/<region>/{base.json,stems.pkl,waters.json} -> public/data/<region>/{base,waters}.json
# Usage: scripts/build-geo.sh [region=r2] [--boundaries]     (npm run data:geo -- r2)
set -euo pipefail
cd "$(dirname "$0")/.."
REG=${1:-r2}; [ $# -gt 0 ] && shift
python3 scripts/geo.py "src/regions/$REG" "raw/$REG" "build/$REG" "$@"
python3 "src/regions/$REG/waters.py" "build/$REG"
mkdir -p "public/data/$REG" && cp "build/$REG/base.json" "build/$REG/waters.json" "public/data/$REG/"
