#!/usr/bin/env bash
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
V951="$(cd "$HERE/.." && pwd)"
ROOT="$(cd "$V951/../.." && pwd)"

test "$(git -C "$ROOT" rev-parse 'HEAD:uk_renewables_pipeline/v9.4')" = "b33f302a76f89de63a620078bb9053566bd41a78"
test "$(git -C "$ROOT" rev-parse 'HEAD:uk_renewables_pipeline/v9.5')" = "95c233bf22ea02424a51e989bdb2ccb4e65066c0"
python3 "$HERE/check_legacy_integrity_v9.py"
python3 "$V951/scripts/data/build_v9_1_spine.py"
git -C "$ROOT" diff --exit-code -- uk_renewables_pipeline/v9.4
git -C "$ROOT" diff --exit-code -- uk_renewables_pipeline/v9.5
git -C "$ROOT" diff --exit-code -- uk_renewables_pipeline/v9.5.1/data/v9.1
python3 "$ROOT/scripts/test_news_binder_v9_5.py"
python3 "$ROOT/scripts/build_news_feed_v9_5_1.py"
git -C "$ROOT" diff --exit-code -- dist/major_project_news_v9_5_1.json
python3 "$ROOT/scripts/test_news_feed_v9_5_1.py"

while IFS= read -r source; do
  node --check "$source"
done < <(find "$V951/scripts" -type f -name '*.js' -print | sort)

node "$HERE/check_v9_5_1.mjs"

if [[ "${V9_BROWSER_SMOKE:-0}" == "1" ]]; then
  browser_base_url="${V9_BASE_URL:-http://127.0.0.1:8765/uk_renewables_pipeline/v9.5.1/}"
  python3 -m http.server 8765 --directory "$ROOT" >/tmp/globalgrid2050-v9-5-1-http.log 2>&1 &
  server_pid=$!
  trap 'kill "$server_pid" 2>/dev/null || true' EXIT
  for _ in {1..20}; do
    if curl --fail --silent --output /dev/null "$browser_base_url"; then
      break
    fi
    sleep 0.25
  done
  curl --fail --silent --output /dev/null "$browser_base_url"
  V9_BASE_URL="$browser_base_url" node "$HERE/browser_smoke_v9_5_1.mjs"
  kill "$server_pid" 2>/dev/null || true
  trap - EXIT
fi

echo "V9.5.1 validation suite: PASS ($ROOT)"
