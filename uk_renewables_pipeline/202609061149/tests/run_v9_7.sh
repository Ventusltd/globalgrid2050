#!/usr/bin/env bash
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
V97="$(cd "$HERE/.." && pwd)"
V962="$(cd "$V97/../202609061004" && pwd)"
ROOT="$(cd "$V97/../.." && pwd)"

test "$(git -C "$ROOT" rev-parse 'HEAD:uk_renewables_pipeline/202609061004')" = "41283e49d32628c9424cbf76003d17da0f8d5b44"

diff -qr -x __pycache__ -x '*.pyc' -x v9.7 "$V962/data" "$V97/data"
diff -qr -x __pycache__ -x '*.pyc' "$V962/fixtures" "$V97/fixtures"

# WHAT V9.7 CHANGES FROM ITS FROZEN PARENT, NAMED ONE FILE AT A TIME.
#
# This was `diff -qr "$V962/styles" "$V97/styles"` and a five-entry script
# list, and by 202609050415 it was already failing: the deep-link work of that
# night had edited styles/v9-6-1.css and scripts/plugins/projects-v9-5-1.js in
# place, so the whole-directory diff went red and nothing in the estate runs
# this script often enough to notice. A gate that is red and unread is not a
# gate. So the divergence is DECLARED rather than the check deleted: every file
# below still has to be byte-identical to v9.6.2, and the three that are
# deliberately not are listed with the reason, which is the part a reader needs.
#
# Adding a file to CHANGED_FROM_PARENT is a governed act. It is the sentence
# "this release owns this file now", and it must be true.
CHANGED_FROM_PARENT=(
  # 202609061149 - the sixteen immutable partition files may be cached.
  # Measured on the live parent, same file, same session: cache no-store cost
  # 454 ms and 533 ms; cache default cost 3 ms.
  scripts/data/canonical-projects-v9-1.js
  # 202609061149 - the table shows a page of twenty, largest first, instead of
  # building 7,680 rows. all and filtered are untouched, so no REPD record
  # leaves the pipeline; only the view is windowed.
  scripts/plugins/projects-v9-5-1.js
  # 202609061149 - the pager's own styles, at 44 px touch targets.
  styles/v9-6-1.css
  # 202609061149 - the release states its own identity. The parent was cut by
  # copying 202609051156 and announced that stamp in its title and banner.
  index.html
  # 202609061149 - the smoke waited for 7,680 rows in the DOM. The view is a
  # page of twenty now, so it waits for that AND for the loader to report the
  # complete 7,680, then exercises the pager.
  tests/browser_smoke_v9_7.mjs
)
is_changed() {
  local needle="$1"
  for entry in "${CHANGED_FROM_PARENT[@]}"; do
    [[ "$entry" == "$needle" ]] && return 0
  done
  return 1
}

while IFS= read -r style; do
  relative="styles/$(basename "$style")"
  is_changed "$relative" || diff -q "$V962/$relative" "$V97/$relative"
done < <(find "$V97/styles" -maxdepth 1 -type f -name '*.css' | sort)

for relative in \
  scripts/core/project-filter-v9-2.js \
  scripts/data/canonical-projects-v9-1.js \
  scripts/data/canonical-projects-v9-5-1.js \
  scripts/plugins/gauges-v9-2.js \
  scripts/plugins/projects-v9-5-1.js \
  scripts/plugins/capacity-presentation-v9-3.js; do
  is_changed "$relative" || diff -q "$V962/$relative" "$V97/$relative"
done

# A typo in the list above must not silently exempt a file from the parity
# check. So every entry has to be a real file in v9.7, and one the parent
# either does not have at all (new in this release) or has DIFFERENTLY. An
# entry naming a file identical to the parent is a stale claim of ownership and
# fails here rather than quietly widening the exemption.
for relative in "${CHANGED_FROM_PARENT[@]}"; do
  test -f "$V97/$relative"
  if [[ -f "$V962/$relative" ]]; then
    ! diff -q "$V962/$relative" "$V97/$relative" >/dev/null
  fi
done

# The inherited chain runs from the CANONICAL directories, not from this
# release's parent copy of them. A timestamped release carries a copy of every
# ancestor runner, and those copies compute their own directory as the version
# under test - so calling the parent's run_v9_6_2.sh asks it to prove that
# 202609061004 IS v9.6.2, which it is not and was never meant to be. It fails
# on the parent's own additions, such as data/v9.7.
V9_BROWSER_SMOKE=0 bash "$ROOT/uk_renewables_pipeline/v9.6.2/tests/run_v9_6_2.sh"
node "$V97/scripts/build/regional-news-v9-7.mjs"
git -C "$ROOT" diff --exit-code -- "uk_renewables_pipeline/$(basename "$V97")/data"
node "$HERE/check_v9_7.mjs"

while IFS= read -r source; do
  node --check "$source"
done < <(find "$V97/scripts" -type f \( -name '*.js' -o -name '*.mjs' \) -print | sort)

if [[ "${V9_BROWSER_SMOKE:-0}" == "1" ]]; then
  browser_base_url="${V9_BASE_URL:-http://127.0.0.1:8765/uk_renewables_pipeline/$(basename "$V97")/}"
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
  # Where the MAP control actually LANDS at a phone viewport, and whether it
  # survives the deep-link contract's origin stalling. Neither had ever been
  # measured; both were broken on the served bytes of 202609050415.
  V9_BASE_URL="$browser_base_url" node "$HERE/browser_map_reachability_v9_7.mjs"
  if [[ -n "${server_pid:-}" ]]; then
    kill "$server_pid" 2>/dev/null || true
    trap - EXIT
  fi
fi

echo "V9.7 validation suite: PASS ($ROOT)"
