#!/usr/bin/env bash
set -euo pipefail

v7_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
repo_root="$(cd "$v7_dir/../.." && pwd)"

python3 "$v7_dir/tests/check_v5_parity.py"
node "$v7_dir/tests/check_modules.mjs"

while IFS= read -r source; do
  node --check "$source"
done < <(find "$v7_dir/scripts" -type f -name '*.js' -print | sort)

if [[ "${V7_BROWSER_SMOKE:-0}" == "1" ]]; then
  node "$v7_dir/tests/browser_smoke.mjs"
fi

python3 "$v7_dir/tests/validate_north_star.py" \
  --phase post \
  --report "$v7_dir/data/build_reports/7.1-postflight.json"

echo "V7.1 validation suite: PASS ($repo_root)"
