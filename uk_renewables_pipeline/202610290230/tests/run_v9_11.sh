#!/usr/bin/env bash
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
V911="$(cd "$HERE/.." && pwd)"
V910="$(cd "$V911/../202609082224" && pwd)"
ROOT="$(cd "$V911/../.." && pwd)"

# The frozen parent, by tree. If 202609082224 changes under this release, this
# release's claims about what it inherited are void.
test "$(git -C "$ROOT" rev-parse 'HEAD:uk_renewables_pipeline/202609082224')" = "6247a0c3c00e8e88324d9ea55b22d67dbbb1be90"

# WHAT V9.11 CHANGES FROM ITS FROZEN PARENT, NAMED ONE FILE AT A TIME.
CHANGED_FROM_PARENT=(
  index.html
  tests/run_v9_11.sh
  tests/check_v9_11.mjs
  CHANGES.md
  README.md
)
# And what it deletes: the V9.10 runner and check assert V9.10's own identity
# and parent, so inside this folder they could only fail.
REMOVED_FROM_PARENT=(
  tests/run_v9_10.sh
  tests/check_v9_10.mjs
)
is_listed() {
  local needle="$1"; shift
  for entry in "$@"; do [[ "$entry" == "$needle" ]] && return 0; done
  return 1
}

# Everything the parent has, this release has byte for byte, unless named above.
while IFS= read -r file; do
  relative="${file#$V910/}"
  is_listed "$relative" "${CHANGED_FROM_PARENT[@]}" && continue
  if is_listed "$relative" "${REMOVED_FROM_PARENT[@]}"; then
    test ! -e "$V911/$relative"
    continue
  fi
  diff -q "$V910/$relative" "$V911/$relative"
done < <(find "$V910" -type f -not -path '*/__pycache__/*' -not -name '*.pyc' -not -path '*/node_modules/*' | sort)

# Nothing new arrives unnamed.
while IFS= read -r file; do
  relative="${file#$V911/}"
  [[ -e "$V910/$relative" ]] && continue
  is_listed "$relative" "${CHANGED_FROM_PARENT[@]}"
done < <(find "$V911" -type f -not -path '*/__pycache__/*' -not -name '*.pyc' -not -path '*/node_modules/*' | sort)

for relative in "${CHANGED_FROM_PARENT[@]}"; do
  test -f "$V911/$relative"
  if [[ -f "$V910/$relative" ]]; then
    ! diff -q "$V910/$relative" "$V911/$relative" >/dev/null
  fi
done

# The only change to the page outside its identity lines is the Chart.js tag.
! grep -q 'src="https://cdn.jsdelivr.net/npm/chart.js"' "$V911/index.html"

# The interconnector product is rebuilt from its pinned fixtures and must not move.
node "$V911/scripts/build/interconnectors-v9-8.mjs"
git -C "$ROOT" diff --exit-code -- "uk_renewables_pipeline/$(basename "$V911")/data/v9.8"
node "$HERE/check_v9_11.mjs"
# Every REPD MAP button, not a sample: 7,680 hrefs with the page's own function.
node "$HERE/check_map_contract_all_rows.mjs"

while IFS= read -r source; do
  node --check "$source"
done < <(find "$V911/scripts" -type f \( -name '*.js' -o -name '*.mjs' \) -print | sort)

echo "V9.11 validation suite: PASS ($ROOT)"
