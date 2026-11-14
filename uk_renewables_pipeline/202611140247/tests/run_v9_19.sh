#!/usr/bin/env bash
# run_v9_19.sh - Pipeline News V9.19: one visible step on its parent, same REPD
# October 2026 (Q3 2026) register. Offline, in a git checkout or a plain copy.
# Written by automation/pipeline_release/new_version.py by the pattern of run_v9_13.sh.
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RELEASE="$(cd "$HERE/.." && pwd)"
ID="$(basename "$RELEASE")"
PARENT_ID="202611140223"
FIXTURE_OWNER="202611132345"
PARENT="$(cd "$RELEASE/../$PARENT_ID" && pwd)"
ROOT="$(cd "$RELEASE/../.." && pwd)"
# The parent by git tree of the bytes ON DISK.
PARENT_TREE="0edd36f51365f9f5b7cdca2927c7e78c4615e41d"

SCRATCH="$(mktemp -d)"
trap 'rm -rf "$SCRATCH"' EXIT
git init -q --bare "$SCRATCH/objects.git"
(cd "$ROOT" && find "uk_renewables_pipeline/$PARENT_ID" -type f -not -path '*/__pycache__/*' -not -name '*.pyc' -not -path '*/node_modules/*' | sort) \
  | GIT_DIR="$SCRATCH/objects.git" GIT_WORK_TREE="$ROOT" GIT_INDEX_FILE="$SCRATCH/index" \
    git -C "$ROOT" -c core.autocrlf=false update-index --add --stdin
actual_tree="$(GIT_DIR="$SCRATCH/objects.git" GIT_INDEX_FILE="$SCRATCH/index" git write-tree --prefix="uk_renewables_pipeline/$PARENT_ID/")"
test "$actual_tree" = "$PARENT_TREE" || { echo "parent $PARENT_ID tree is $actual_tree, expected $PARENT_TREE" >&2; exit 1; }

# WHAT THIS VERSION CHANGES FROM ITS PARENT, NAMED ONE FILE AT A TIME.
CHANGED_FROM_PARENT=(
  CHANGES.md
  README.md
  index.html
  tests/check_v9_19.mjs
  tests/run_v9_19.sh
)
REMOVED_FROM_PARENT=(
  tests/check_v9_18.mjs
  tests/run_v9_18.sh
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
PYTHONDONTWRITEBYTECODE=1 python3 "$COPY/scripts/data/build_v9_1_spine.py"
diff -r "$RELEASE/data/v9.1" "$COPY/data/v9.1"
node "$COPY/scripts/build/interconnectors-v9-8.mjs" >/dev/null
diff -r "$RELEASE/data/v9.8" "$COPY/data/v9.8"

node "$HERE/check_v9_19.mjs"
node "$HERE/check_map_contract_all_rows.mjs"

while IFS= read -r source; do
  node --check "$source"
done < <(find "$RELEASE/scripts" -type f \( -name '*.js' -o -name '*.mjs' \) -print | sort)

echo "V9.19 ($ID) validation suite: PASS ($ROOT)"
