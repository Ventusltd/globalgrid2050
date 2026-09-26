#!/usr/bin/env bash
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
V98="$(cd "$HERE/.." && pwd)"
V97="$(cd "$V98/../202609061329" && pwd)"
ROOT="$(cd "$V98/../.." && pwd)"

# The frozen parent, by tree. If 202609061329 changes under this release, this
# release's claims about what it inherited are void.
test "$(git -C "$ROOT" rev-parse 'HEAD:uk_renewables_pipeline/202609061329')" = "42f0ebde853eb84236593ac7d455107e069ddeeb"

# The REPD spine and its fixtures are the parent's, byte for byte. v9.8 is the
# interconnector product and its three pinned inputs, and is checked separately.
diff -qr -x __pycache__ -x '*.pyc' -x v9.8 "$V97/data" "$V98/data"
diff -qr -x __pycache__ -x '*.pyc' -x v9.8 "$V97/fixtures" "$V98/fixtures"

# WHAT V9.8 CHANGES FROM ITS FROZEN PARENT, NAMED ONE FILE AT A TIME.
# Every file below must differ from the parent or be new; a stale entry fails.
CHANGED_FROM_PARENT=(
  # 202609071221 - the release states its own identity, carries the
  # INTERCONNECTORS tab, and loads the v9.8 app.
  index.html
  # 202609071221 - the runner for this release.
  tests/run_v9_8.sh
  # 202609071221 - the interconnector product, its builder, loader, link
  # module, plugin and app entry are new files; the parity list below still
  # holds for every inherited module, none of which is edited.
  scripts/app-v9-8.js
  scripts/plugins/projects-v9-8.js
  scripts/data/interconnectors-v9-8.js
  scripts/core/atlas-interconnector-link-v9-8.js
  scripts/build/interconnectors-v9-8.mjs
  tests/check_v9_8.mjs
  tests/browser_smoke_v9_8.mjs
  contracts/interconnectors.v9.8.json
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

while IFS= read -r style; do
  relative="styles/$(basename "$style")"
  is_changed "$relative" || diff -q "$V97/$relative" "$V98/$relative"
done < <(find "$V98/styles" -maxdepth 1 -type f -name '*.css' | sort)

# Inherited modules that must be byte-identical to the parent. projects-v9-5-1
# is on this list on purpose: v9.8 derives projects-v9-8.js from it and leaves
# the original untouched, so the parent's app would still run from these bytes.
for relative in \
  scripts/app-v9-7.js \
  scripts/core/atlas-receiver-v9-7.js \
  scripts/core/project-filter-v9-2.js \
  scripts/data/canonical-projects-v9-1.js \
  scripts/data/canonical-projects-v9-5-1.js \
  scripts/plugins/gauges-v9-2.js \
  scripts/plugins/projects-v9-5-1.js \
  scripts/plugins/newspaper-v9-7.js \
  scripts/plugins/capacity-presentation-v9-3.js \
  tests/check_map_contract_all_rows.mjs \
  tests/check_v9_7.mjs; do
  is_changed "$relative" || diff -q "$V97/$relative" "$V98/$relative"
done

for relative in "${CHANGED_FROM_PARENT[@]}"; do
  test -f "$V98/$relative"
  if [[ -f "$V97/$relative" ]]; then
    ! diff -q "$V97/$relative" "$V98/$relative" >/dev/null
  fi
done

# The data product is rebuilt from its pinned fixtures and must not move.
node "$V98/scripts/build/interconnectors-v9-8.mjs"
git -C "$ROOT" diff --exit-code -- "uk_renewables_pipeline/$(basename "$V98")/data/v9.8"
node "$HERE/check_v9_8.mjs"
# Every REPD MAP button, not a sample: 7,680 hrefs with the page's own function.
node "$HERE/check_map_contract_all_rows.mjs"

while IFS= read -r source; do
  node --check "$source"
done < <(find "$V98/scripts" -type f \( -name '*.js' -o -name '*.mjs' \) -print | sort)

if [[ "${V9_BROWSER_SMOKE:-0}" == "1" ]]; then
  browser_base_url="${V9_BASE_URL:-http://127.0.0.1:8765/uk_renewables_pipeline/$(basename "$V98")/}"
  if [[ "$browser_base_url" == http://127.0.0.1:* ]]; then
    python3 -m http.server 8765 --directory "$ROOT" >/tmp/globalgrid2050-v9-8-http.log 2>&1 &
    server_pid=$!
    trap 'kill "$server_pid" 2>/dev/null || true' EXIT
    for _ in {1..20}; do
      if curl --fail --silent --output /dev/null "$browser_base_url"; then break; fi
      sleep 0.25
    done
    curl --fail --silent --output /dev/null "$browser_base_url"
  fi
  V9_BASE_URL="$browser_base_url" node "$HERE/browser_smoke_v9_8.mjs"
  V9_BASE_URL="$browser_base_url" node "$HERE/browser_map_reachability_v9_7.mjs"
  if [[ -n "${server_pid:-}" ]]; then
    kill "$server_pid" 2>/dev/null || true
    trap - EXIT
  fi
fi

echo "V9.8 validation suite: PASS ($ROOT)"
