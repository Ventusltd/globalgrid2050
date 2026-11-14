#!/usr/bin/env bash
# Usage: run.sh <pages repo checkout> <january dir> <october dir or staged CSV> <out dir>
# If arg 3 is a CSV file, a stand-in October set is built from it first (make_standin.py).
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
PAGES="$1"; JAN="$2"; OCT="$3"; OUT="$4"
mkdir -p "$OUT"
[ -d "$HERE/node_modules/papaparse" ] || (cd "$HERE" && npm ci --no-audit --no-fund)
if [ -f "$OCT" ]; then
  python3 "$HERE/make_standin.py" --staged "$OCT" --out "$OUT/october_standin" --repo "$PAGES" \
      --columns-like "$JAN/repd-solar-operational.csv"
  OCT="$OUT/october_standin"
fi
node "$HERE/harness.js" --pages "$PAGES" --set "jan=$JAN" --set "oct=$OCT" \
     --json "$OUT/results.json" --md "$OUT/results.md"
