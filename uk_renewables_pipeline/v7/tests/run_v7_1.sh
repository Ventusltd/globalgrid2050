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
  browser_base_url="${V7_BASE_URL:-http://127.0.0.1:8765/uk_renewables_pipeline/v7/}"
  python3 -m http.server 8765 --directory "$repo_root" >/tmp/globalgrid2050-v7-http.log 2>&1 &
  server_pid=$!
  trap 'kill "$server_pid" 2>/dev/null || true' EXIT
  for _ in {1..20}; do
    if curl --fail --silent --output /dev/null "$browser_base_url"; then
      break
    fi
    sleep 0.25
  done
  curl --fail --silent --output /dev/null "$browser_base_url"
  V7_BASE_URL="$browser_base_url" node "$v7_dir/tests/browser_smoke.mjs"
  kill "$server_pid" 2>/dev/null || true
  trap - EXIT
fi

north_star_report="${V7_NORTH_STAR_REPORT:-${TMPDIR:-/tmp}/globalgrid2050-v7-postflight.json}"
python3 "$v7_dir/tests/validate_north_star.py" \
  --phase post \
  --report "$north_star_report"

if [[ -f "$v7_dir/contracts/project-spine.v7.2.json" ]]; then
  python3 "$v7_dir/tests/test_v7_2_spine_safety.py"
  python3 "$v7_dir/tests/validate_v7_2_spine.py"
fi

if [[ -f "$v7_dir/contracts/projects-plugin.v7.2.json" ]]; then
  python3 "$v7_dir/tests/validate_projects_plugin_v7_2.py" --phase spec
  node "$v7_dir/tests/check_v7_2_project_model.mjs"
  node "$v7_dir/tests/check_v7_2_project_controls.mjs"
fi

echo "V7.1 validation suite: PASS ($repo_root)"
