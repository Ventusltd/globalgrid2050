#!/usr/bin/env bash
# run_v9_27.sh - Pipeline News V9.27: one visible step on its parent, same REPD
# October 2026 (Q3 2026) register. Offline, in a git checkout or a plain copy.
# Written by automation/pipeline_release/new_version.py by the pattern of run_v9_13.sh.
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RELEASE="$(cd "$HERE/.." && pwd)"
ID="$(basename "$RELEASE")"
PARENT_ID="202611161734"
FIXTURE_OWNER="202611132345"
PARENT="$(cd "$RELEASE/../$PARENT_ID" && pwd)"
ROOT="$(cd "$RELEASE/../.." && pwd)"
# The parent by git tree of the bytes ON DISK.
PARENT_TREE="66616800b2a865e506508fb6e7d991ea435f94e9"

SCRATCH="$(mktemp -d)"
trap 'rm -rf "$SCRATCH"' EXIT
actual_tree="$(python - "$ROOT" "$PARENT_ID" <<'PYTREE'
import sys
sys.path.insert(0, sys.argv[1] + "/automation/pipeline_release")
from common import tree_hash
print(tree_hash(sys.argv[2]))
PYTREE
)"
test "$actual_tree" = "$PARENT_TREE" || { echo "parent $PARENT_ID tree is $actual_tree, expected $PARENT_TREE" >&2; exit 1; }

# WHAT THIS VERSION CHANGES FROM ITS PARENT, NAMED ONE FILE AT A TIME.
CHANGED_FROM_PARENT=(
  CHANGES.md
  README.md
  index.html
  prospecting/README.md
  prospecting/manifest.json
  prospecting/priority.csv
  prospecting/priority.json
  scripts/plugins/prospecting/adapter.mjs
  scripts/plugins/prospecting/bundle.mjs
  scripts/plugins/prospecting/view.mjs
  scripts/plugins/research-priority-v927.js
  styles/research-priority-v927.css
  tests/check_v9_27.mjs
  tests/run_v9_27.sh
)
REMOVED_FROM_PARENT=(
  tests/check_v9_26.mjs
  tests/run_v9_26.sh
)
is_listed() {
  local needle="$1"; shift
  for entry in "$@"; do [[ "$entry" == "$needle" ]] && return 0; done
  return 1
}
walk() { find "$1" -type f -not -path '*/__pycache__/*' -not -name '*.pyc' -not -path '*/node_modules/*' | sort; }

while IFS= read -r file; do
  relative="${file#$PARENT/}"
  is_listed "$relative" "${CHANGED_FROM_PARENT[@]}" && continue
  if is_listed "$relative" "${REMOVED_FROM_PARENT[@]}"; then
    test ! -e "$RELEASE/$relative" || { echo "should not be copied: $relative" >&2; exit 1; }
    continue
  fi
  cmp -s "$file" "$RELEASE/$relative" || { echo "inherited file differs from parent: $relative" >&2; exit 1; }
done < <(walk "$PARENT")
while IFS= read -r file; do
  relative="${file#$RELEASE/}"
  is_listed "$relative" "${CHANGED_FROM_PARENT[@]}" && continue
  test -e "$PARENT/$relative" || { echo "unlisted new file: $relative" >&2; exit 1; }
done < <(walk "$RELEASE")
for relative in "${CHANGED_FROM_PARENT[@]}"; do
  test -f "$RELEASE/$relative" || { echo "listed but missing: $relative" >&2; exit 1; }
  if [[ -f "$PARENT/$relative" ]] && cmp -s "$PARENT/$relative" "$RELEASE/$relative"; then
    echo "listed as changed but identical to parent: $relative" >&2; exit 1
  fi
done

# The register is the parent's: contract, spine and interconnector product byte for byte.
cmp -s "$PARENT/contracts/release.v9.1.json" "$RELEASE/contracts/release.v9.1.json"
grep -q "\"identity_fixture\": \"uk_renewables_pipeline/$FIXTURE_OWNER/fixtures/2026q3/project_identity_2026q3.json\"" "$RELEASE/contracts/release.v9.1.json"
diff -r "$PARENT/data/v9.1" "$RELEASE/data/v9.1"
diff -r "$PARENT/data/v9.8" "$RELEASE/data/v9.8"

# Spine and interconnector product rebuilt in a scratch root that holds this version
# and, at the fixture owner's path, only the two fixtures the contract binds. They
# must reproduce the committed bytes.
SROOT="$SCRATCH/root"
COPY="$SROOT/uk_renewables_pipeline/$ID"
mkdir -p "$SROOT/uk_renewables_pipeline/$FIXTURE_OWNER/fixtures"
cp -a "$ROOT/uk_renewables_pipeline/$FIXTURE_OWNER/fixtures/2026q3" "$SROOT/uk_renewables_pipeline/$FIXTURE_OWNER/fixtures/"
cp -a "$RELEASE" "$COPY"
rm -rf "$COPY/data/v9.1"
PYTHONDONTWRITEBYTECODE=1 python "$COPY/scripts/data/build_v9_1_spine.py"
diff -r "$RELEASE/data/v9.1" "$COPY/data/v9.1"
node "$COPY/scripts/build/interconnectors-v9-8.mjs" >/dev/null
diff -r "$RELEASE/data/v9.8" "$COPY/data/v9.8"

node "$HERE/check_v9_27.mjs"
node "$HERE/check_map_contract_all_rows.mjs"

while IFS= read -r source; do
  node --check "$source"
done < <(find "$RELEASE/scripts" -type f \( -name '*.js' -o -name '*.mjs' \) -print | sort)

echo "V9.27 ($ID) validation suite: PASS ($ROOT)"
