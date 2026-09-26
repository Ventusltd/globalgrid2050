#!/usr/bin/env bash
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
V910="$(cd "$HERE/.." && pwd)"
V99="$(cd "$V910/../202609081016" && pwd)"
ROOT="$(cd "$V910/../.." && pwd)"

# The frozen parent, by tree. If 202609081016 changes under this release, this
# release's claims about what it inherited are void.
test "$(git -C "$ROOT" rev-parse 'HEAD:uk_renewables_pipeline/202609081016')" = "f9fd82e0dd9f05807a2a544e4600ebf3ced55439"

# WHAT V9.10 CHANGES FROM ITS FROZEN PARENT, NAMED ONE FILE AT A TIME.
CHANGED_FROM_PARENT=(
  index.html
  styles/v9-10.css
  tests/run_v9_10.sh
  tests/check_v9_10.mjs
  CHANGES.md
  README.md
)
# And what it deletes. v9.9's app and plugin existed only to print the offshore
# sentence this release removes, so they go rather than linger as dead files.
REMOVED_FROM_PARENT=(
  scripts/app-v9-9.js
  scripts/plugins/projects-v9-9.js
  tests/run_v9_9.sh
  tests/check_v9_9.mjs
)
is_listed() {
  local needle="$1"; shift
  for entry in "$@"; do [[ "$entry" == "$needle" ]] && return 0; done
  return 1
}

# Everything the parent has, this release has byte for byte, unless named above.
while IFS= read -r file; do
  relative="${file#$V99/}"
  is_listed "$relative" "${CHANGED_FROM_PARENT[@]}" && continue
  if is_listed "$relative" "${REMOVED_FROM_PARENT[@]}"; then
    test ! -e "$V910/$relative"
    continue
  fi
  diff -q "$V99/$relative" "$V910/$relative"
done < <(find "$V99" -type f -not -path '*/__pycache__/*' -not -name '*.pyc' -not -path '*/node_modules/*' | sort)

for relative in "${CHANGED_FROM_PARENT[@]}"; do
  test -f "$V910/$relative"
  if [[ -f "$V99/$relative" ]]; then
    ! diff -q "$V99/$relative" "$V910/$relative" >/dev/null
  fi
done

# The offshore sentence is gone from every file this release ships.
! grep -rq "Opens on the offshore cable engine" "$V910"

# The interconnector product is rebuilt from its pinned fixtures and must not move.
node "$V910/scripts/build/interconnectors-v9-8.mjs"
git -C "$ROOT" diff --exit-code -- "uk_renewables_pipeline/$(basename "$V910")/data/v9.8"
node "$HERE/check_v9_10.mjs"
# Every REPD MAP button, not a sample: 7,680 hrefs with the page's own function.
node "$HERE/check_map_contract_all_rows.mjs"

while IFS= read -r source; do
  node --check "$source"
done < <(find "$V910/scripts" -type f \( -name '*.js' -o -name '*.mjs' \) -print | sort)

echo "V9.10 validation suite: PASS ($ROOT)"
