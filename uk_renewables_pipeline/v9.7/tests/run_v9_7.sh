#!/usr/bin/env bash
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
V97="$(cd "$HERE/.." && pwd)"
V962="$(cd "$V97/../v9.6.2" && pwd)"
ROOT="$(cd "$V97/../.." && pwd)"

test "$(git -C "$ROOT" rev-parse 'HEAD:uk_renewables_pipeline/v9.6.2')" = "d978c215bceaab6666e4bf17af782191d8fab49e"

diff -qr -x __pycache__ -x '*.pyc' -x v9.7 "$V962/data" "$V97/data"
diff -qr -x __pycache__ -x '*.pyc' "$V962/fixtures" "$V97/fixtures"

# THE MAP-ROUTE REPAIR IS AN ALLOWED DELTA, NOT A DRIFT.
#
# This block used to say, flatly, that V9.7's project styles and project plugins
# were byte-identical to the frozen V9.6.2 parent. That was true the day V9.7 was
# cut and stopped being true on 2026-09-05, when the Atlas deep-link repair
# (5fa6ebf7, 313f5623) landed in every live version - V9.7 included. Seven
# plugins here now read the receiver from the deep-link contract the engine
# publishes instead of each carrying its own copy of a route that had quietly
# stopped carrying the engine, and one stylesheet gained the .map-note rule that
# prints in the cell why a record has no map point, because a phone reports
# hover: none and cannot reach a title attribute. 87fe1250 trimmed that work back
# and moved the release forward to 202609051156, but it left these files repaired
# on purpose: the fix was wanted, the extra test scaffolding was not.
#
# Since then `diff -qr styles` has failed on every push, on files nobody was
# touching - two LF-only stylesheets of 321 and 738 bytes that genuinely differ.
# That is how a red run stopped meaning anything here.
#
# The gate is not loosened, it is made specific. Every file the repair touched is
# named, with the blob the parent must hold and the blob this version must hold.
# Anything that is not exactly this repair - a drift, a re-edit, a half-finished
# revert of the kind 87fe1250 left behind - is still red, and so is any change to
# a file outside the list.
assert_blob() {
  actual="$(git -C "$ROOT" rev-parse "HEAD:$1" 2>/dev/null || true)"
  if [ "$actual" != "$2" ]; then
    echo "V9.7 allowed-delta gate: $1 is ${actual:-absent}, expected $2" >&2
    exit 1
  fi
}

diff -qr -x v9-6-1.css "$V962/styles" "$V97/styles"
assert_blob uk_renewables_pipeline/v9.6.2/styles/v9-6-1.css bb5c920402ba3639ef165de59cc2e4c345861322
assert_blob uk_renewables_pipeline/v9.7/styles/v9-6-1.css cd936f0cd102cca4f5bbbf3113a28a366c66a122

for relative in \
  scripts/core/project-filter-v9-2.js \
  scripts/data/canonical-projects-v9-5-1.js \
  scripts/plugins/gauges-v9-2.js \
  scripts/plugins/capacity-presentation-v9-3.js; do
  diff -q "$V962/$relative" "$V97/$relative"
done

# The seven project plugins the deep-link repair rewrote, pinned on both sides.
# projects-v9-5-1.js is the one the app actually loads; the other six are carried
# for archive fidelity and were repaired with it. The flat diff above only ever
# covered one of the seven, so six of them could drift unseen - the gate that was
# failing was also the gate that was not looking.
assert_blob uk_renewables_pipeline/v9.6.2/scripts/plugins/projects-v9-1.js cc36472e4d9d23146851f928408b6efaea85cdcb
assert_blob uk_renewables_pipeline/v9.7/scripts/plugins/projects-v9-1.js 4259f28f52b5113ae3b33f7bb6f0ff29da3b4699
assert_blob uk_renewables_pipeline/v9.6.2/scripts/plugins/projects-v9-2.js 0e222ea75e9db8dc3e9f1e829a15ac3ee1ca0acf
assert_blob uk_renewables_pipeline/v9.7/scripts/plugins/projects-v9-2.js e0697a60666700a9f73ccbe608005c905f052a48
assert_blob uk_renewables_pipeline/v9.6.2/scripts/plugins/projects-v9-3.js c28216d1e4a4d26cb13dcf99cc1f9886e6c9e276
assert_blob uk_renewables_pipeline/v9.7/scripts/plugins/projects-v9-3.js 4d26d31f9acfae5360875e4ad27e54d1dbc328ae
assert_blob uk_renewables_pipeline/v9.6.2/scripts/plugins/projects-v9-4.js 15f1e132344924075f81c39886c50c9fdea13ff7
assert_blob uk_renewables_pipeline/v9.7/scripts/plugins/projects-v9-4.js a5437c9a584d156210a52a0097b52ce9db100108
assert_blob uk_renewables_pipeline/v9.6.2/scripts/plugins/projects-v9-5.js 9d9c8f3fb660b8ffbd071f82b805082f387a7002
assert_blob uk_renewables_pipeline/v9.7/scripts/plugins/projects-v9-5.js 5ac0583723a12a3280cfc0ab33728c0d52135237
assert_blob uk_renewables_pipeline/v9.6.2/scripts/plugins/projects-v9-5-1.js ac2cffee071baee3e297053f3f6334de10ab8004
assert_blob uk_renewables_pipeline/v9.7/scripts/plugins/projects-v9-5-1.js 41442816749072255e2e15fcebdaf7979a795544
assert_blob uk_renewables_pipeline/v9.6.2/scripts/plugins/canonical-project-table.js be1098e923cbcf37a05cd5150d1350303af315d8
assert_blob uk_renewables_pipeline/v9.7/scripts/plugins/canonical-project-table.js 8c983a2777b1d5950891afe737d692c951879189

V9_BROWSER_SMOKE=0 bash "$V962/tests/run_v9_6_2.sh"
node "$V97/scripts/build/regional-news-v9-7.mjs"
git -C "$ROOT" diff --exit-code -- uk_renewables_pipeline/v9.7/data/v9.7
node "$HERE/check_v9_7.mjs"

while IFS= read -r source; do
  node --check "$source"
done < <(find "$V97/scripts" -type f \( -name '*.js' -o -name '*.mjs' \) -print | sort)

if [[ "${V9_BROWSER_SMOKE:-0}" == "1" ]]; then
  browser_base_url="${V9_BASE_URL:-http://127.0.0.1:8765/uk_renewables_pipeline/v9.7/}"
  if [[ "$browser_base_url" == http://127.0.0.1:* ]]; then
    python3 -m http.server 8765 --directory "$ROOT" >/tmp/globalgrid2050-v9-7-http.log 2>&1 &
    server_pid=$!
    trap 'kill "$server_pid" 2>/dev/null || true' EXIT
    for _ in {1..20}; do
      if curl --fail --silent --output /dev/null "$browser_base_url"; then break; fi
      sleep 0.25
    done
    curl --fail --silent --output /dev/null "$browser_base_url"
  fi
  V9_BASE_URL="$browser_base_url" node "$HERE/browser_smoke_v9_7.mjs"
  if [[ -n "${server_pid:-}" ]]; then
    kill "$server_pid" 2>/dev/null || true
    trap - EXIT
  fi
fi

echo "V9.7 validation suite: PASS ($ROOT)"
