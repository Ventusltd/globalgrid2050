#!/usr/bin/env bash
# run_v9_12.sh - REPD Q3 2026 (October 2026) data refresh of the operative
# Pipeline News release. Runs offline, in a git checkout or a plain copy.
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RELEASE="$(cd "$HERE/.." && pwd)"
ID="$(basename "$RELEASE")"
PARENT_ID="202609082224"
PARENT="$(cd "$RELEASE/../$PARENT_ID" && pwd)"
ROOT="$(cd "$RELEASE/../.." && pwd)"
PARENT_TREE="6247a0c3c00e8e88324d9ea55b22d67dbbb1be90"

# The frozen parent, by git tree of the bytes ON DISK (not of HEAD), computed in
# a throwaway object store so this also works in a plain copy. If the parent
# changes under this release, this release's claims about what it inherited are void.
SCRATCH="$(mktemp -d)"
trap 'rm -rf "$SCRATCH"' EXIT
git init -q --bare "$SCRATCH/objects.git"
(cd "$ROOT" && find "uk_renewables_pipeline/$PARENT_ID" -type f -not -path '*/__pycache__/*' -not -name '*.pyc' -not -path '*/node_modules/*' | sort) \
  | GIT_DIR="$SCRATCH/objects.git" GIT_WORK_TREE="$ROOT" GIT_INDEX_FILE="$SCRATCH/index" \
    git -C "$ROOT" -c core.autocrlf=false update-index --add --stdin
actual_tree="$(GIT_DIR="$SCRATCH/objects.git" GIT_INDEX_FILE="$SCRATCH/index" git write-tree --prefix="uk_renewables_pipeline/$PARENT_ID/")"
test "$actual_tree" = "$PARENT_TREE" || { echo "parent $PARENT_ID tree is $actual_tree, expected $PARENT_TREE" >&2; exit 1; }

# WHAT THIS RELEASE CHANGES FROM ITS FROZEN PARENT, NAMED ONE FILE AT A TIME.
CHANGED_FROM_PARENT=(
  index.html
  README.md
  CHANGES.md
  contracts/release.v9.1.json
  contracts/release.v9.5.1.json
  scripts/data/build_v9_1_spine.py
  scripts/plugins/projects-v9-8.js
  tests/run_v9_12.sh
  tests/check_v9_12.mjs
  fixtures/2026q3/project_identity_2026q3.json
  fixtures/2026q3/repd_2026q3_coordinates.json
)
# data/v9.1 is REBUILT, not edited: every file there is proven below by a
# rebuild from the fixtures, so it is listed as a whole.
REBUILT_DIR="data/v9.1"
REMOVED_FROM_PARENT=(
  tests/run_v9_10.sh
  tests/check_v9_10.mjs
)
is_listed() {
  local needle="$1"; shift
  for entry in "$@"; do [[ "$entry" == "$needle" ]] && return 0; done
  return 1
}
walk() { find "$1" -type f -not -path '*/__pycache__/*' -not -name '*.pyc' -not -path '*/node_modules/*' | sort; }

# Everything the parent has, this release has byte for byte, unless named above.
while IFS= read -r file; do
  relative="${file#$PARENT/}"
  [[ "$relative" == "$REBUILT_DIR/"* ]] && continue
  is_listed "$relative" "${CHANGED_FROM_PARENT[@]}" && continue
  if is_listed "$relative" "${REMOVED_FROM_PARENT[@]}"; then
    test ! -e "$RELEASE/$relative"
    continue
  fi
  cmp -s "$file" "$RELEASE/$relative" || { echo "inherited file differs from parent: $relative" >&2; exit 1; }
done < <(walk "$PARENT")
# And nothing this release ships is unnamed.
while IFS= read -r file; do
  relative="${file#$RELEASE/}"
  [[ "$relative" == "$REBUILT_DIR/"* ]] && continue
  is_listed "$relative" "${CHANGED_FROM_PARENT[@]}" && continue
  test -e "$PARENT/$relative" || { echo "unlisted new file: $relative" >&2; exit 1; }
done < <(walk "$RELEASE")
for relative in "${CHANGED_FROM_PARENT[@]}"; do
  test -f "$RELEASE/$relative"
  if [[ -f "$PARENT/$relative" ]]; then
    ! cmp -s "$PARENT/$relative" "$RELEASE/$relative"
  fi
done

# The spine builder reads and writes THIS folder (one line differs from the parent's).
diff <(grep -v '^V9 = ' "$PARENT/scripts/data/build_v9_1_spine.py") <(grep -v '^V9 = ' "$RELEASE/scripts/data/build_v9_1_spine.py")
grep -q '^V9 = Path(__file__).resolve().parents\[2\]' "$RELEASE/scripts/data/build_v9_1_spine.py"

# The spine and the interconnector product are rebuilt in a scratch copy of this
# release and must reproduce the committed bytes. Nothing outside the scratch copy
# is written, so this gate is not vacuous and cannot dirty uk_renewables_pipeline/v9.
COPY="$SCRATCH/root/uk_renewables_pipeline/$ID"
mkdir -p "$(dirname "$COPY")"
cp -a "$RELEASE" "$COPY"
rm -rf "$COPY/data/v9.1"
PYTHONDONTWRITEBYTECODE=1 python3 "$COPY/scripts/data/build_v9_1_spine.py"
diff -r "$RELEASE/data/v9.1" "$COPY/data/v9.1"
node "$COPY/scripts/build/interconnectors-v9-8.mjs" >/dev/null
diff -r "$RELEASE/data/v9.8" "$COPY/data/v9.8"
test ! -e "$SCRATCH/root/uk_renewables_pipeline/v9"

# Optional: rebuild the coordinate fixture from the official workbook.
if [[ -n "${REPD_XLSX:-}" ]]; then
  python3 - "$RELEASE" "$COPY" "$REPD_XLSX" <<'PY'
import json, subprocess, sys
from pathlib import Path
release, copy, xlsx = map(Path, sys.argv[1:])
c = json.loads((release / "contracts/release.v9.1.json").read_text())
root = release.parents[1]
sys.path.insert(0, str(copy / "scripts/data"))
import build_v7_2_spine as b
ident = json.loads((root / c["source"]["identity_fixture"]).read_text())["records"]
out = copy / "fixtures/2026q3/rebuilt_coordinates.json"
b.build_coordinate_fixture(xlsx, ident, out)
assert b.sha256(out) == c["source"]["coordinate_fixture_sha256"], "coordinate fixture does not rebuild byte-for-byte"
print("coordinate fixture rebuilt byte-for-byte from", xlsx.name)
PY
fi

# The CSV export must not carry the Q2 reconciliation count (it is read from
# the build manifest now), and nothing else in the served plugins may either.
if grep -n '14657/14657' "$RELEASE/scripts/plugins/projects-v9-8.js"; then
  echo "projects-v9-8.js still carries the Q2 reconciliation count" >&2; exit 1
fi
python3 -c 'import json,sys; m=json.load(open(sys.argv[1])); assert m["source_record_count"]==14967, m["source_record_count"]' "$RELEASE/data/v9.1/build_manifest.json"

node "$HERE/check_v9_12.mjs"
# Every REPD MAP button, not a sample: every href with the page's own function.
node "$HERE/check_map_contract_all_rows.mjs"

while IFS= read -r source; do
  node --check "$source"
done < <(find "$RELEASE/scripts" -type f \( -name '*.js' -o -name '*.mjs' \) -print | sort)

echo "V9.12 ($ID) validation suite: PASS ($ROOT)"
