#!/usr/bin/env bash
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
V9="$(cd "$HERE/.." && pwd)"
ROOT="$(cd "$V9/../.." && pwd)"

test "$(git -C "$ROOT" rev-parse '59f74e319fbaad62abdb995107dba5759d7f3ca2^{tree}')" = "e9dc244b74d9c983e4557a23bd2b745c1daeb105"
bash "$ROOT/uk_renewables_pipeline/v9/tests/run_v9_1.sh"
git -C "$ROOT" diff --exit-code -- uk_renewables_pipeline/v9/data/v9.1
node --check "$V9/scripts/core/project-filter-v9-2.js"
node --check "$V9/scripts/core/news-relevance-v9-2.js"
node --check "$V9/scripts/data/canonical-projects-v9-2.js"
node --check "$V9/scripts/plugins/gauges-v9-2.js"
node --check "$V9/scripts/plugins/newspaper-v9-2.js"
node --check "$V9/scripts/plugins/projects-v9-2.js"
node --check "$V9/scripts/app.js"
node "$HERE/check_v9_2.mjs"
echo "V9.2 validation suite: PASS ($ROOT)"
