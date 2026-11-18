#!/usr/bin/env bash
set -euo pipefail

v9_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
repo_root="$(cd "$v9_dir/../.." && pwd)"

bash "$repo_root/uk_renewables_pipeline/v8/tests/run_v8_1.sh"
python3 "$v9_dir/tests/check_legacy_integrity_v9.py"
node "$v9_dir/tests/check_v9_0.mjs"

while IFS= read -r source; do
  node --check "$source"
done < <(find "$v9_dir/scripts" -type f -name '*.js' -print | sort)

echo "V9.0 validation suite: PASS ($repo_root)"
