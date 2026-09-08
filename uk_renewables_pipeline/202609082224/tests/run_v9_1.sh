#!/usr/bin/env bash
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
V9="$(cd "$HERE/.." && pwd)"
ROOT="$(cd "$V9/../.." && pwd)"

test "$(git -C "$ROOT" rev-parse '50a6df6c4bd54ff4c113aaf0df4f230b7c9544d2^{tree}')" = "60b72b3665e6b65a397541b221c4bca75aa402c9"
bash "$ROOT/uk_renewables_pipeline/v8/tests/run_v8_1.sh"
python3 "$HERE/check_legacy_integrity_v9.py"
python3 "$V9/scripts/data/build_v9_1_spine.py"
node --check "$V9/scripts/data/canonical-projects-v9-1.js"
node --check "$V9/scripts/plugins/gauges-v9-1.js"
node --check "$V9/scripts/plugins/projects-v9-1.js"
node "$HERE/check_v9_1.mjs"
echo "V9.1 validation suite: PASS ($ROOT)"
