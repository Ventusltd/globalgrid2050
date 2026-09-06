#!/usr/bin/env bash
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
V962="$(cd "$HERE/.." && pwd)"
V961="$(cd "$V962/../v9.6.1" && pwd)"
ROOT="$(cd "$V962/../.." && pwd)"

test "$(git -C "$ROOT" rev-parse 'HEAD:uk_renewables_pipeline/v9.6.1')" = "d642d905fea5e682c12cb996fb5cbd0827aca575"

diff -qr -x __pycache__ -x '*.pyc' "$V961/data" "$V962/data"
diff -qr -x __pycache__ -x '*.pyc' "$V961/fixtures" "$V962/fixtures"

V9_BROWSER_SMOKE=0 bash "$V961/tests/run_v9_6_1.sh"
node "$HERE/check_v9_6_2.mjs"

while IFS= read -r source; do
  node --check "$source"
done < <(find "$V962/scripts" -type f -name '*.js' -print | sort)

if [[ "${V9_BROWSER_SMOKE:-0}" == "1" ]]; then
  browser_base_url="${V9_BASE_URL:-http://127.0.0.1:8765/uk_renewables_pipeline/v9.6.2/}"
  if [[ "$browser_base_url" == http://127.0.0.1:* ]]; then
    python3 -m http.server 8765 --directory "$ROOT" >/tmp/globalgrid2050-v9-6-2-http.log 2>&1 &
    server_pid=$!
    trap 'kill "$server_pid" 2>/dev/null || true' EXIT
    for _ in {1..20}; do
      if curl --fail --silent --output /dev/null "$browser_base_url"; then break; fi
      sleep 0.25
    done
    curl --fail --silent --output /dev/null "$browser_base_url"
  fi
  V9_BASE_URL="$browser_base_url" node "$HERE/browser_smoke_v9_6_2.mjs"
  if [[ -n "${server_pid:-}" ]]; then
    kill "$server_pid" 2>/dev/null || true
    trap - EXIT
  fi
fi

echo "V9.6.2 validation suite: PASS ($ROOT)"
