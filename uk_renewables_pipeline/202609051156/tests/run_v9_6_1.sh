#!/usr/bin/env bash
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
V961="$(cd "$HERE/.." && pwd)"
V951="$(cd "$V961/../v9.5.1" && pwd)"
ROOT="$(cd "$V961/../.." && pwd)"

test "$(git -C "$ROOT" rev-parse 'HEAD:uk_renewables_pipeline/v9.5.1')" = "cc1ebf8ddb8654934b861e4d0d2df73926076674"

# Prove the requested clone boundary before testing behaviour.
diff -qr -x __pycache__ -x '*.pyc' "$V951/data" "$V961/data"
diff -qr -x __pycache__ -x '*.pyc' "$V951/scripts" "$V961/scripts"
diff -qr -x __pycache__ -x '*.pyc' "$V951/fixtures" "$V961/fixtures"

# Re-run the complete frozen-parent data, news, identity and static suite.
# Do not leak V9.6.1's browser flag into the frozen parent: Playwright is
# installed in the V9.6.1 package and its browser proof below covers both apps.
V9_BROWSER_SMOKE=0 bash "$V951/tests/run_v9_5_1.sh"

# Run the stricter allowed-delta gate against the V9.6.1 clone. The complete
# inherited runtime behaviour is exercised by the browser proof below.
node "$HERE/check_v9_6_1.mjs"

while IFS= read -r source; do
  node --check "$source"
done < <(find "$V961/scripts" -type f -name '*.js' -print | sort)

if [[ "${V9_BROWSER_SMOKE:-0}" == "1" ]]; then
  browser_base_url="${V9_BASE_URL:-http://127.0.0.1:8765/uk_renewables_pipeline/v9.6.1/}"
  if [[ "$browser_base_url" == http://127.0.0.1:* ]]; then
    python3 -m http.server 8765 --directory "$ROOT" >/tmp/globalgrid2050-v9-6-1-http.log 2>&1 &
    server_pid=$!
    trap 'kill "$server_pid" 2>/dev/null || true' EXIT
    for _ in {1..20}; do
      if curl --fail --silent --output /dev/null "$browser_base_url"; then
        break
      fi
      sleep 0.25
    done
    curl --fail --silent --output /dev/null "$browser_base_url"
  fi
  V9_BASE_URL="$browser_base_url" node "$HERE/browser_smoke_v9_6_1.mjs"
  if [[ -n "${server_pid:-}" ]]; then
    kill "$server_pid" 2>/dev/null || true
    trap - EXIT
  fi
fi

echo "V9.6.1 validation suite: PASS ($ROOT)"
