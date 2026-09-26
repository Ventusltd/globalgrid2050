#!/usr/bin/env bash
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
V95="$(cd "$HERE/.." && pwd)"
ROOT="$(cd "$V95/../.." && pwd)"

test "$(git -C "$ROOT" rev-parse 'HEAD:uk_renewables_pipeline/v9.4')" = "c274af911f786fb0385e7fb96f4e20ae7dec1de3"
python3 "$HERE/check_legacy_integrity_v9.py"
python3 "$V95/scripts/data/build_v9_1_spine.py"
git -C "$ROOT" diff --exit-code -- uk_renewables_pipeline/v9.4
git -C "$ROOT" diff --exit-code -- uk_renewables_pipeline/v9.5/data/v9.1
python3 "$ROOT/scripts/test_news_binder_v9_5.py"

while IFS= read -r source; do
  node --check "$source"
done < <(find "$V95/scripts" -type f -name '*.js' -print | sort)

node "$HERE/check_v9_5.mjs"

if [[ "${V9_BROWSER_SMOKE:-0}" == "1" ]]; then
  browser_base_url="${V9_BASE_URL:-http://127.0.0.1:8765/uk_renewables_pipeline/v9.5/}"
  python3 -m http.server 8765 --directory "$ROOT" >/tmp/globalgrid2050-v9-5-http.log 2>&1 &
  server_pid=$!
  trap 'kill "$server_pid" 2>/dev/null || true' EXIT
  for _ in {1..20}; do
    if curl --fail --silent --output /dev/null "$browser_base_url"; then
      break
    fi
    sleep 0.25
  done
  curl --fail --silent --output /dev/null "$browser_base_url"
  V9_BASE_URL="$browser_base_url" node "$HERE/browser_smoke_v9_5.mjs"
  kill "$server_pid" 2>/dev/null || true
  trap - EXIT
fi

echo "V9.5 validation suite: PASS ($ROOT)"
