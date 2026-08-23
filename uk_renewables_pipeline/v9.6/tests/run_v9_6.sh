#!/usr/bin/env bash
set -euo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$HERE/../../.." && pwd)"

python3 "$ROOT/uk_renewables_pipeline/v9.6/tests/check_legacy_integrity_v9.py"
node "$ROOT/uk_renewables_pipeline/v9.6/tests/check_v9_6.mjs"

if [[ "${V9_BROWSER_SMOKE:-0}" == "1" ]]; then
  python3 -m http.server 8765 --directory "$ROOT" >/tmp/globalgrid-v9-6-server.log 2>&1 &
  server_pid=$!
  trap 'kill "$server_pid" 2>/dev/null || true' EXIT
  node "$ROOT/uk_renewables_pipeline/v9.6/tests/browser_smoke_v9_6.mjs"
fi

echo "V9.6 clean rebuild validation: PASS"
