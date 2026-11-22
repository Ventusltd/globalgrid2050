#!/usr/bin/env bash
set -euo pipefail

v8_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
repo_root="$(cd "$v8_dir/../.." && pwd)"
expected_v7_tree="9ad8cfe9cdf26948ed3ad3898822977f9198006a"

bash "$repo_root/uk_renewables_pipeline/v7/tests/run_v7_1.sh"

actual_v7_tree="$(git -C "$repo_root" rev-parse HEAD:uk_renewables_pipeline/v7)"
if [[ "$actual_v7_tree" != "$expected_v7_tree" ]]; then
  echo "V8.1 gate: V7 fallback tree changed ($actual_v7_tree)" >&2
  exit 1
fi

python3 "$v8_dir/tests/test_v7_2_spine_safety.py"
python3 "$v8_dir/tests/validate_v7_2_spine.py"
python3 "$v8_dir/tests/validate_projects_plugin_v7_2.py" --phase spec
node "$v8_dir/tests/check_v7_2_project_model.mjs"
node "$v8_dir/tests/check_v8_1_mvp.mjs"

while IFS= read -r source; do
  node --check "$source"
done < <(find "$v8_dir/scripts" -type f -name '*.js' -print | sort)

if [[ "${V8_BROWSER_SMOKE:-0}" == "1" ]]; then
  browser_base_url="${V8_BASE_URL:-http://127.0.0.1:8765/uk_renewables_pipeline/v8/}"
  python3 -m http.server 8765 --directory "$repo_root" >/tmp/globalgrid2050-v8-http.log 2>&1 &
  server_pid=$!
  trap 'kill "$server_pid" 2>/dev/null || true' EXIT
  for _ in {1..20}; do
    if curl --fail --silent --output /dev/null "$browser_base_url"; then
      break
    fi
    sleep 0.25
  done
  curl --fail --silent --output /dev/null "$browser_base_url"
  V8_BASE_URL="$browser_base_url" node "$v8_dir/tests/browser_smoke_v8_1.mjs"
  kill "$server_pid" 2>/dev/null || true
  trap - EXIT
fi

echo "V8.1 validation suite: PASS ($repo_root)"
