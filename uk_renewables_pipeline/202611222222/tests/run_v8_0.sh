#!/usr/bin/env bash
set -euo pipefail

v8_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
repo_root="$(cd "$v8_dir/../.." && pwd)"

bash "$repo_root/uk_renewables_pipeline/v7/tests/run_v7_1.sh"
python3 "$v8_dir/tests/check_v8_baseline.py"

while IFS= read -r source; do
  node --check "$source"
done < <(find "$v8_dir/scripts" -type f -name '*.js' -print | sort)

echo "V8.0 validation suite: PASS ($repo_root)"
