#!/usr/bin/env bash
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
V97="$(cd "$HERE/.." && pwd)"
V962="$(cd "$V97/../v9.6.2" && pwd)"
ROOT="$(cd "$V97/../.." && pwd)"

test "$(git -C "$ROOT" rev-parse 'HEAD:uk_renewables_pipeline/v9.6.2')" = "bf51084b4775792ebd61d48180573fc4a9ca5fba"

diff -qr -x __pycache__ -x '*.pyc' -x v9.7 "$V962/data" "$V97/data"
diff -qr -x __pycache__ -x '*.pyc' "$V962/fixtures" "$V97/fixtures"
diff -qr "$V962/styles" "$V97/styles"
for relative in \
  scripts/core/project-filter-v9-2.js \
  scripts/data/canonical-projects-v9-5-1.js \
  scripts/plugins/gauges-v9-2.js \
  scripts/plugins/projects-v9-5-1.js \
  scripts/plugins/capacity-presentation-v9-3.js; do
  diff -q "$V962/$relative" "$V97/$relative"
done

V9_BROWSER_SMOKE=0 bash "$V962/tests/run_v9_6_2.sh"
node "$V97/scripts/build/regional-news-v9-7.mjs"
git -C "$ROOT" diff --exit-code -- uk_renewables_pipeline/v9.7/data/v9.7
node "$HERE/check_v9_7.mjs"

while IFS= read -r source; do
  node --check "$source"
done < <(find "$V97/scripts" -type f \( -name '*.js' -o -name '*.mjs' \) -print | sort)

if [[ "${V9_BROWSER_SMOKE:-0}" == "1" ]]; then
  browser_base_url="${V9_BASE_URL:-http://127.0.0.1:8765/uk_renewables_pipeline/v9.7/}"
  if [[ "$browser_base_url" == http://127.0.0.1:* ]]; then
    python3 -m http.server 8765 --directory "$ROOT" >/tmp/globalgrid2050-v9-7-http.log 2>&1 &
    server_pid=$!
    trap 'kill "$server_pid" 2>/dev/null || true' EXIT
    for _ in {1..20}; do
      if curl --fail --silent --output /dev/null "$browser_base_url"; then break; fi
      sleep 0.25
    done
    curl --fail --silent --output /dev/null "$browser_base_url"
  fi
  V9_BASE_URL="$browser_base_url" node "$HERE/browser_smoke_v9_7.mjs"
  if [[ -n "${server_pid:-}" ]]; then
    kill "$server_pid" 2>/dev/null || true
    trap - EXIT
  fi
fi

echo "V9.7 validation suite: PASS ($ROOT)"
