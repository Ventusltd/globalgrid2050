#!/usr/bin/env bash
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
V99="$(cd "$HERE/.." && pwd)"
V98="$(cd "$V99/../202609071221" && pwd)"
ROOT="$(cd "$V99/../.." && pwd)"

# The frozen parent, by tree. If 202609071221 changes under this release, this
# release's claims about what it inherited are void.
test "$(git -C "$ROOT" rev-parse 'HEAD:uk_renewables_pipeline/202609071221')" = "36e30da95537e29938df59b9a68724c78f1d4593"

# WHAT V9.9 CHANGES FROM ITS FROZEN PARENT, NAMED ONE FILE AT A TIME.
# Every file below must differ from the parent or be new; a stale entry fails.
CHANGED_FROM_PARENT=(
  index.html
  scripts/app-v9-9.js
  scripts/plugins/projects-v9-9.js
  tests/run_v9_9.sh
  tests/check_v9_9.mjs
  CHANGES.md
  README.md
)
is_changed() {
  local needle="$1"
  for entry in "${CHANGED_FROM_PARENT[@]}"; do
    [[ "$entry" == "$needle" ]] && return 0
  done
  return 1
}

# Everything the parent has, this release has byte for byte, unless named above.
# projects-v9-8.js and app-v9-8.js are on this list on purpose: v9.9 derives its
# plugin and entry from them and leaves the originals untouched, so the parent's
# app would still run from these bytes.
while IFS= read -r file; do
  relative="${file#$V98/}"
  is_changed "$relative" || diff -q "$V98/$relative" "$V99/$relative"
done < <(find "$V98" -type f -not -path '*/__pycache__/*' -not -name '*.pyc' -not -path '*/node_modules/*' | sort)

for relative in "${CHANGED_FROM_PARENT[@]}"; do
  test -f "$V99/$relative"
  if [[ -f "$V98/$relative" ]]; then
    ! diff -q "$V98/$relative" "$V99/$relative" >/dev/null
  fi
done

# The interconnector product is rebuilt from its pinned fixtures and must not move.
node "$V99/scripts/build/interconnectors-v9-8.mjs"
git -C "$ROOT" diff --exit-code -- "uk_renewables_pipeline/$(basename "$V99")/data/v9.8"
node "$HERE/check_v9_9.mjs"
# Every REPD MAP button, not a sample: 7,680 hrefs with the page's own function.
node "$HERE/check_map_contract_all_rows.mjs"

while IFS= read -r source; do
  node --check "$source"
done < <(find "$V99/scripts" -type f \( -name '*.js' -o -name '*.mjs' \) -print | sort)

echo "V9.9 validation suite: PASS ($ROOT)"
