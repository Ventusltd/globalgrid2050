#!/usr/bin/env bash
# run_v9_13.sh - REPD October 2026 (Q3 2026) release: the V9.12 candidate's register
# under a release label, with the CSV source-count fix. Offline, in a git checkout
# or a plain copy.
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RELEASE="$(cd "$HERE/.." && pwd)"
ID="$(basename "$RELEASE")"
PARENT_ID="202611132345"
PARENT="$(cd "$RELEASE/../$PARENT_ID" && pwd)"
ROOT="$(cd "$RELEASE/../.." && pwd)"
# The parent by git tree of the bytes ON DISK. Two trees are accepted, both named:
#   a3f76f61... = globalgrid2050 f9ccd703, the bytes served and hash-verified when the
#                 homepage was first pointed at 202611132345;
#   0c7a4ed5... = the same folder after PR #63 (d5de5a03) changed CHANGES.md,
#                 scripts/plugins/projects-v9-8.js and tests/run_v9_12.sh in place.
# Restoring those three files returns the parent to the first tree; either way the
# data and the fixtures this release binds are the same bytes.
PARENT_TREES=(a3f76f610dff9da15090df56181fdbccc2e210fa 0c7a4ed5ea369e4a4e71a45cfa6fe9c186fae773)

SCRATCH="$(mktemp -d)"
trap 'rm -rf "$SCRATCH"' EXIT
git init -q --bare "$SCRATCH/objects.git"
(cd "$ROOT" && find "uk_renewables_pipeline/$PARENT_ID" -type f -not -path '*/__pycache__/*' -not -name '*.pyc' -not -path '*/node_modules/*' | sort) \
  | GIT_DIR="$SCRATCH/objects.git" GIT_WORK_TREE="$ROOT" GIT_INDEX_FILE="$SCRATCH/index" \
    git -C "$ROOT" -c core.autocrlf=false update-index --add --stdin
actual_tree="$(GIT_DIR="$SCRATCH/objects.git" GIT_INDEX_FILE="$SCRATCH/index" git write-tree --prefix="uk_renewables_pipeline/$PARENT_ID/")"
tree_ok=0
for tree in "${PARENT_TREES[@]}"; do [[ "$actual_tree" == "$tree" ]] && tree_ok=1; done
test "$tree_ok" = 1 || { echo "parent $PARENT_ID tree is $actual_tree, expected one of ${PARENT_TREES[*]}" >&2; exit 1; }

# WHAT THIS RELEASE CHANGES FROM ITS PARENT, NAMED ONE FILE AT A TIME.
CHANGED_FROM_PARENT=(
  index.html
  README.md
  CHANGES.md
  tests/run_v9_13.sh
  tests/check_v9_13.mjs
)
# Pinned by content, not by parity: the parent holds either the pre-fix or the
# fixed bytes of this file (see PARENT_TREES); this release always holds the fix.
PINNED_FILES=(scripts/plugins/projects-v9-8.js)
PINNED_SHA256=(f4174d3af1b867a911ec49d3cfdfdd7823225384e25e8e1cb711ff07c7fe90d6)
REMOVED_FROM_PARENT=(
  tests/run_v9_12.sh
  tests/check_v9_12.mjs
  fixtures/2026q3/project_identity_2026q3.json
  fixtures/2026q3/repd_2026q3_coordinates.json
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
  is_listed "$relative" "${PINNED_FILES[@]}" && continue
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
  test -f "$RELEASE/$relative"
  if [[ -f "$PARENT/$relative" ]] && cmp -s "$PARENT/$relative" "$RELEASE/$relative"; then
    echo "listed as changed but identical to parent: $relative" >&2; exit 1
  fi
done
for i in "${!PINNED_FILES[@]}"; do
  got="$(sha256sum "$RELEASE/${PINNED_FILES[$i]}" | cut -d' ' -f1)"
  test "$got" = "${PINNED_SHA256[$i]}" || { echo "${PINNED_FILES[$i]} is $got, expected ${PINNED_SHA256[$i]}" >&2; exit 1; }
done

# The fixtures are the parent's: the contract is the parent's byte for byte and
# names them under uk_renewables_pipeline/$PARENT_ID/fixtures/ with their sha256.
cmp -s "$PARENT/contracts/release.v9.1.json" "$RELEASE/contracts/release.v9.1.json"
grep -q "\"identity_fixture\": \"uk_renewables_pipeline/$PARENT_ID/fixtures/2026q3/project_identity_2026q3.json\"" "$RELEASE/contracts/release.v9.1.json"
grep -q '^V9 = Path(__file__).resolve().parents\[2\]' "$RELEASE/scripts/data/build_v9_1_spine.py"

# CSV text: the "Source Reconciliation" column comes from the build manifest, never
# from the Q2 literal.
if grep -n '14657/14657' "$RELEASE/scripts/plugins/projects-v9-8.js"; then
  echo "projects-v9-8.js carries the Q2 reconciliation count" >&2; exit 1
fi
grep -q 'reconciliationNote()' "$RELEASE/scripts/plugins/projects-v9-8.js"
python3 -c 'import json,sys; m=json.load(open(sys.argv[1])); assert m["source_record_count"]==14967, m["source_record_count"]' "$RELEASE/data/v9.1/build_manifest.json"

# Spine and interconnector product rebuilt in a scratch root that holds this release
# and, at the parent's path, only the two fixtures the contract binds. They must
# reproduce the committed bytes.
SROOT="$SCRATCH/root"
COPY="$SROOT/uk_renewables_pipeline/$ID"
mkdir -p "$SROOT/uk_renewables_pipeline/$PARENT_ID/fixtures"
cp -a "$PARENT/fixtures/2026q3" "$SROOT/uk_renewables_pipeline/$PARENT_ID/fixtures/"
cp -a "$RELEASE" "$COPY"
rm -rf "$COPY/data/v9.1"
PYTHONDONTWRITEBYTECODE=1 python3 "$COPY/scripts/data/build_v9_1_spine.py"
diff -r "$RELEASE/data/v9.1" "$COPY/data/v9.1"
node "$COPY/scripts/build/interconnectors-v9-8.mjs" >/dev/null
diff -r "$RELEASE/data/v9.8" "$COPY/data/v9.8"
test ! -e "$SROOT/uk_renewables_pipeline/v9"

if [[ -n "${REPD_XLSX:-}" ]]; then
  python3 - "$RELEASE" "$COPY" "$REPD_XLSX" <<'PY'
import json, sys
from pathlib import Path
release, copy, xlsx = map(Path, sys.argv[1:])
c = json.loads((release / "contracts/release.v9.1.json").read_text())
root = release.parents[1]
sys.path.insert(0, str(copy / "scripts/data"))
import build_v7_2_spine as b
ident = json.loads((root / c["source"]["identity_fixture"]).read_text())["records"]
out = copy.parent / "rebuilt_coordinates.json"
b.build_coordinate_fixture(xlsx, ident, out)
assert b.sha256(out) == c["source"]["coordinate_fixture_sha256"], "coordinate fixture does not rebuild byte-for-byte"
print("coordinate fixture rebuilt byte-for-byte from", xlsx.name)
PY
fi

node "$HERE/check_v9_13.mjs"
node "$HERE/check_map_contract_all_rows.mjs"

while IFS= read -r source; do
  node --check "$source"
done < <(find "$RELEASE/scripts" -type f \( -name '*.js' -o -name '*.mjs' \) -print | sort)

echo "V9.13 ($ID) validation suite: PASS ($ROOT)"
