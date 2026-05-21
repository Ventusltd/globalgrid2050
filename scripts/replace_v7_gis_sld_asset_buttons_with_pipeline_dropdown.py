#!/usr/bin/env python3
"""
Replace V7 GIS SLD asset buttons with a pipeline dropdown and capacity range filter.

Purpose:
- Reverse oversized operating asset marker styling.
- Use Atlas V8 REPD master data as pipeline context, not only operational assets.
- Replace four cockpit buttons with one compact dropdown plus min/max MW fields.
- Let users filter Solar PV, BESS, Onshore Wind, Offshore Wind or all energy assets.

Scope:
- V7 GIS SLD only.
"""

from __future__ import annotations

import datetime as dt
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
APP = ROOT / "solar-bess-topology-v7" / "gis-sld-financial-sandbox"
INDEX = APP / "index.html"
MAP_JS = APP / "gis-sld-v5-map.js"
UI_JS = APP / "gis-sld-v5-ui.js"
CSS = APP / "gis-sld-v5.css"
REPORTS = ROOT / "gridbot_reports"
REPORT = REPORTS / "replace_v7_gis_sld_asset_buttons_with_pipeline_dropdown.md"
TEST_FILE = ROOT / "scripts" / "test_v7_gis_sld_asset_pipeline_dropdown.py"

OLD_ASSET_ROW_START = '        <div class="map-toggle-row asset-toggle-row">'
OLD_ASSET_ROW_END = '        </div>\n    </div>\n\n    <div class="crosshair">⌖</div>'
NEW_ASSET_ROW = '''        <div class="map-toggle-row asset-toggle-row asset-filter-row">
            <select id="asset_layer_select" class="map-asset-select" title="Energy asset layer">
                <option value="off">Energy assets OFF</option>
                <option value="all">All pipeline assets</option>
                <option value="solar_operational">Solar PV pipeline</option>
                <option value="bess_operational">BESS pipeline</option>
                <option value="wind_onshore_operational">Onshore wind pipeline</option>
                <option value="wind_offshore_operational">Offshore wind pipeline</option>
            </select>
            <input id="asset_min_mw" class="asset-range-input" type="number" min="0" step="1" placeholder="Min MW" title="Minimum project capacity MW" />
            <input id="asset_max_mw" class="asset-range-input" type="number" min="0" step="1" placeholder="Max MW" title="Maximum project capacity MW" />
            <button id="btn_asset_filter_apply" class="map-toggle-btn">APPLY</button>
        </div>
    </div>

    <div class="crosshair">⌖</div>'''

STATE_OLD = '''const atlasV8OperatingAssetVisibility = {
    "solar_operational": false,
    "wind_onshore_operational": false,
    "wind_offshore_operational": false,
    "bess_operational": false
};'''
STATE_NEW = '''const atlasV8OperatingAssetVisibility = {
    "solar_operational": false,
    "wind_onshore_operational": false,
    "wind_offshore_operational": false,
    "bess_operational": false
};

const atlasV8AssetFilterState = {
    selected: "off",
    minMw: null,
    maxMw: null
};'''

TOGGLE_FUNCTION_START = 'function toggleAtlasV8OperatingAssetLayer(assetKey) {'
TOGGLE_FUNCTION_END = 'function toggleAtlasV8GridLayer(voltageKey) {'
NEW_ASSET_FUNCTIONS = r'''function atlasV8CapacityExpression() {
    return ["to-number", ["coalesce", ["get", "capacity"], ["get", "capacity_mw"], 0]];
}

function atlasV8AssetBaseFilter(assetKey) {
    if (assetKey === "solar_operational") return ["==", ["get", "tech"], "solar"];
    if (assetKey === "bess_operational") return ["==", ["get", "tech"], "bess"];
    if (assetKey === "wind_onshore_operational") return ["==", ["get", "raw_tech"], "Wind Onshore"];
    if (assetKey === "wind_offshore_operational") return ["==", ["get", "raw_tech"], "Wind Offshore"];
    return true;
}

function atlasV8AssetFilter(assetKey) {
    const filters = ["all", atlasV8AssetBaseFilter(assetKey)];
    const capacityExpr = atlasV8CapacityExpression();
    if (Number.isFinite(atlasV8AssetFilterState.minMw)) filters.push([">=", capacityExpr, atlasV8AssetFilterState.minMw]);
    if (Number.isFinite(atlasV8AssetFilterState.maxMw)) filters.push(["<=", capacityExpr, atlasV8AssetFilterState.maxMw]);
    return filters;
}

function applyAtlasV8AssetDropdownFilter(selected = atlasV8AssetFilterState.selected, minMw = atlasV8AssetFilterState.minMw, maxMw = atlasV8AssetFilterState.maxMw) {
    atlasV8AssetFilterState.selected = selected || "off";
    atlasV8AssetFilterState.minMw = Number.isFinite(minMw) ? minMw : null;
    atlasV8AssetFilterState.maxMw = Number.isFinite(maxMw) ? maxMw : null;

    Object.keys(atlasV8OperatingAssetLayerIds).forEach(assetKey => {
        const layerId = atlasV8OperatingAssetLayerIds[assetKey];
        const visible = atlasV8AssetFilterState.selected === "all" || atlasV8AssetFilterState.selected === assetKey;
        atlasV8OperatingAssetVisibility[assetKey] = visible;
        if (map && map.getLayer(layerId)) {
            map.setFilter(layerId, atlasV8AssetFilter(assetKey));
            map.setLayoutProperty(layerId, "visibility", visible ? "visible" : "none");
        }
    });
    updateLegend?.();
}

function toggleAtlasV8OperatingAssetLayer(assetKey) {
    if (!atlasV8OperatingAssetLayerIds[assetKey]) return;
    const next = atlasV8AssetFilterState.selected === assetKey ? "off" : assetKey;
    applyAtlasV8AssetDropdownFilter(next, atlasV8AssetFilterState.minMw, atlasV8AssetFilterState.maxMw);
}

'''

# Radius replacement targets. These restore sensible, readable markers and avoid giant dots.
RADIUS_PATTERNS = [
    '"circle-radius": ["interpolate", ["linear"], ["coalesce", ["get", "capacity"], 0], 0, 6, 10, 10, 29.99, 14, 30, 28, 50, 32, 100, 38, 200, 44, 350, 52, 500, 60]',
    '"circle-radius": ["interpolate", ["linear"], ["coalesce", ["get", "capacity"], 0], 0, 5, 10, 8, 29.99, 12, 30, 20, 50, 24, 100, 30, 200, 36, 350, 44, 500, 52]',
    '"circle-radius": ["interpolate", ["linear"], ["coalesce", ["get", "capacity"], 0], 0, 6, 10, 10, 29.99, 14, 30, 24, 50, 28, 100, 34, 200, 40, 350, 48, 500, 56]',
]
DEFAULT_RADIUS = '"circle-radius": ["interpolate", ["linear"], ["coalesce", ["get", "capacity"], 0], 0, 5, 10, 7, 30, 9, 50, 10, 100, 12, 200, 15, 350, 18, 500, 21]'

STATUS_FILTERS = [
    ', ["==", ["get", "status"], "operational"]',
    '["all", ["==", ["get", "tech"], "solar"], ["==", ["get", "status"], "operational"]]',
    '["all", ["==", ["get", "raw_tech"], "Wind Onshore"], ["==", ["get", "status"], "operational"]]',
    '["all", ["==", ["get", "raw_tech"], "Wind Offshore"], ["==", ["get", "status"], "operational"]]',
    '["all", ["==", ["get", "tech"], "bess"], ["==", ["get", "status"], "operational"]]',
]
STATUS_REPLACEMENTS = {
    '["all", ["==", ["get", "tech"], "solar"], ["==", ["get", "status"], "operational"]]': '["all", ["==", ["get", "tech"], "solar"]]',
    '["all", ["==", ["get", "raw_tech"], "Wind Onshore"], ["==", ["get", "status"], "operational"]]': '["all", ["==", ["get", "raw_tech"], "Wind Onshore"]]',
    '["all", ["==", ["get", "raw_tech"], "Wind Offshore"], ["==", ["get", "status"], "operational"]]': '["all", ["==", ["get", "raw_tech"], "Wind Offshore"]]',
    '["all", ["==", ["get", "tech"], "bess"], ["==", ["get", "status"], "operational"]]': '["all", ["==", ["get", "tech"], "bess"]]',
}

UI_INSERT_MARKER = 'function updateAtlasV8OperatingAssetToggleButtons() {'
NEW_UI_FUNCTIONS = r'''function readAssetFilterCapacityValue(id) {
    const el = $(id);
    if (!el || String(el.value || "").trim() === "") return null;
    const value = Number(el.value);
    return Number.isFinite(value) && value >= 0 ? value : null;
}

function updateAtlasV8OperatingAssetDropdown() {
    const select = $("asset_layer_select");
    if (select) select.value = atlasV8AssetFilterState?.selected || "off";
    const minInput = $("asset_min_mw");
    const maxInput = $("asset_max_mw");
    if (minInput && Number.isFinite(atlasV8AssetFilterState?.minMw)) minInput.value = atlasV8AssetFilterState.minMw;
    if (maxInput && Number.isFinite(atlasV8AssetFilterState?.maxMw)) maxInput.value = atlasV8AssetFilterState.maxMw;
}

function applyAssetDropdownFromControls() {
    const selected = $("asset_layer_select")?.value || "off";
    let minMw = readAssetFilterCapacityValue("asset_min_mw");
    let maxMw = readAssetFilterCapacityValue("asset_max_mw");
    if (Number.isFinite(minMw) && Number.isFinite(maxMw) && minMw > maxMw) {
        const temp = minMw;
        minMw = maxMw;
        maxMw = temp;
        if ($("asset_min_mw")) $("asset_min_mw").value = minMw;
        if ($("asset_max_mw")) $("asset_max_mw").value = maxMw;
    }
    applyAtlasV8AssetDropdownFilter?.(selected, minMw, maxMw);
    updateAtlasV8OperatingAssetDropdown();
}

function wireAtlasV8OperatingAssetDropdown() {
    $("asset_layer_select")?.addEventListener("change", applyAssetDropdownFromControls);
    $("btn_asset_filter_apply")?.addEventListener("click", applyAssetDropdownFromControls);
    ["asset_min_mw", "asset_max_mw"].forEach(id => {
        $(id)?.addEventListener("keydown", e => {
            if (e.key === "Enter") applyAssetDropdownFromControls();
        });
        $(id)?.addEventListener("change", applyAssetDropdownFromControls);
    });
    updateAtlasV8OperatingAssetDropdown();
}

'''
WIRE_OLD = 'wireAtlasV8OperatingAssetToggleButtons();'
WIRE_NEW = 'wireAtlasV8OperatingAssetDropdown();'

CSS_MARKER = '/* GLOBALGRID2050 V7 ASSET PIPELINE DROPDOWN FILTER */'
CSS_PATCH = r'''

/* GLOBALGRID2050 V7 ASSET PIPELINE DROPDOWN FILTER */
.asset-filter-row {
    gap: 6px;
}
.map-asset-select,
.asset-range-input {
    height: 32px;
    background: rgba(0, 0, 0, 0.84);
    color: #00ff88;
    border: 1px solid #2f343d;
    border-radius: 4px;
    font-family: "Courier New", monospace;
    font-size: 11px;
    font-weight: bold;
    padding: 6px 8px;
}
.map-asset-select {
    min-width: 190px;
}
.asset-range-input {
    width: 76px;
    text-align: center;
}
.map-asset-select:focus,
.asset-range-input:focus {
    outline: none;
    border-color: #00ff88;
}
@media (max-width: 900px) {
    .asset-filter-row {
        display: flex !important;
        flex-wrap: wrap !important;
        justify-content: center !important;
        position: relative !important;
        z-index: 35 !important;
    }
    .map-asset-select {
        min-width: 190px;
        max-width: 220px;
    }
    .asset-range-input {
        width: 72px;
    }
}
@media (max-width: 520px) {
    .map-asset-select {
        min-width: 190px;
        width: 190px;
    }
    .asset-range-input {
        width: 70px;
    }
}
@media print {
    .asset-filter-row {
        display: none !important;
    }
}
'''

TEST_CONTENT = r'''#!/usr/bin/env python3
"""Static checks for V7 GIS SLD asset pipeline dropdown."""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
APP = ROOT / "solar-bess-topology-v7" / "gis-sld-financial-sandbox"
index = (APP / "index.html").read_text(encoding="utf-8")
map_js = (APP / "gis-sld-v5-map.js").read_text(encoding="utf-8")
ui = (APP / "gis-sld-v5-ui.js").read_text(encoding="utf-8")
css = (APP / "gis-sld-v5.css").read_text(encoding="utf-8")

for token in ["asset_layer_select", "asset_min_mw", "asset_max_mw", "btn_asset_filter_apply"]:
    assert token in index, token
assert "asset-layer-btn" not in index, "old asset buttons should be replaced"
for token in ["atlasV8AssetFilterState", "applyAtlasV8AssetDropdownFilter", "atlasV8AssetFilter"]:
    assert token in map_js, token
assert '["==", ["get", "status"], "operational"]' not in map_js, "asset layers should include pipeline statuses, not operational only"
assert "500, 60" not in map_js, "oversized marker radius should be removed"
for token in ["wireAtlasV8OperatingAssetDropdown", "applyAssetDropdownFromControls"]:
    assert token in ui, token
for token in ["map-asset-select", "asset-range-input", "ASSET PIPELINE DROPDOWN FILTER"]:
    assert token in css, token
print("V7 GIS SLD asset pipeline dropdown static checks passed.")
'''


def read(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def write(path: Path, text: str) -> None:
    path.write_text(text, encoding="utf-8")


def replace_between(text: str, start: str, end: str, replacement: str) -> tuple[str, bool]:
    if 'id="asset_layer_select"' in text:
        return text, False
    start_idx = text.find(start)
    if start_idx < 0:
        raise SystemExit("asset row start marker not found")
    end_idx = text.find(end, start_idx)
    if end_idx < 0:
        raise SystemExit("asset row end marker not found")
    return text[:start_idx] + replacement + text[end_idx + len(end):], True


def main() -> int:
    actions: list[str] = []

    index = read(INDEX)
    index, changed = replace_between(index, OLD_ASSET_ROW_START, OLD_ASSET_ROW_END, NEW_ASSET_ROW)
    if changed:
        actions.append("replaced four asset buttons with one asset dropdown and min/max MW filters")
    else:
        actions.append("asset dropdown already present")
    write(INDEX, index)

    map_js = read(MAP_JS)
    if "const atlasV8AssetFilterState" not in map_js:
        if STATE_OLD not in map_js:
            raise SystemExit("asset state marker not found")
        map_js = map_js.replace(STATE_OLD, STATE_NEW, 1)
        actions.append("added asset filter state")
    else:
        actions.append("asset filter state already present")

    if "function atlasV8CapacityExpression" not in map_js:
        start = map_js.find(TOGGLE_FUNCTION_START)
        end = map_js.find(TOGGLE_FUNCTION_END)
        if start < 0 or end < 0 or end <= start:
            raise SystemExit("asset function replacement markers not found")
        map_js = map_js[:start] + NEW_ASSET_FUNCTIONS + "\n" + map_js[end:]
        actions.append("added dropdown driven asset filtering functions")
    else:
        actions.append("dropdown driven asset filtering functions already present")

    replaced_radius = 0
    for pattern in RADIUS_PATTERNS:
        while pattern in map_js:
            map_js = map_js.replace(pattern, DEFAULT_RADIUS, 1)
            replaced_radius += 1
    if replaced_radius:
        actions.append(f"reversed oversized marker radius expressions: {replaced_radius}")
    else:
        actions.append("no oversized marker radius expressions found or already reverted")

    for old, new in STATUS_REPLACEMENTS.items():
        if old in map_js:
            map_js = map_js.replace(old, new)
    actions.append("removed operational only status filters from asset layers so pipeline statuses can be analysed")

    write(MAP_JS, map_js)

    ui = read(UI_JS)
    if "function wireAtlasV8OperatingAssetDropdown" not in ui:
        if UI_INSERT_MARKER not in ui:
            raise SystemExit("UI insert marker not found")
        ui = ui.replace(UI_INSERT_MARKER, NEW_UI_FUNCTIONS + UI_INSERT_MARKER, 1)
        actions.append("added asset dropdown UI functions")
    else:
        actions.append("asset dropdown UI functions already present")

    if WIRE_OLD in ui:
        ui = ui.replace(WIRE_OLD, WIRE_NEW, 1)
        actions.append("wired asset dropdown instead of old button set")
    elif WIRE_NEW in ui:
        actions.append("asset dropdown already wired")
    else:
        raise SystemExit("asset wiring marker not found")
    write(UI_JS, ui)

    css = read(CSS)
    if CSS_MARKER not in css:
        css = css.rstrip() + CSS_PATCH + "\n"
        actions.append("added asset dropdown CSS")
    else:
        actions.append("asset dropdown CSS already present")
    write(CSS, css)

    write(TEST_FILE, TEST_CONTENT)
    actions.append("added static test script")

    REPORTS.mkdir(parents=True, exist_ok=True)
    REPORT.write_text("\n".join([
        "# Replace V7 GIS SLD Asset Buttons With Pipeline Dropdown",
        "",
        f"UTC created: {dt.datetime.now(dt.timezone.utc).isoformat()}",
        "",
        "## Purpose",
        "",
        "Reverse oversized asset marker styling and replace separate solar, BESS and wind buttons with a compact pipeline dropdown and MW capacity range filters.",
        "",
        "## Behaviour",
        "",
        "- Energy asset layers use Atlas V8 REPD master pipeline data, not operational status only.",
        "- Asset cockpit row becomes one dropdown plus min MW, max MW and APPLY.",
        "- Dropdown options: OFF, all pipeline assets, Solar PV, BESS, Onshore Wind, Offshore Wind.",
        "- Users can analyse project size bands by entering minimum and maximum MW.",
        "- Marker sizes return to restrained readable values.",
        "",
        "## Actions",
        "",
        *[f"- {a}" for a in actions],
        "",
        "## Test",
        "",
        "Run `python scripts/test_v7_gis_sld_asset_pipeline_dropdown.py`.",
        "",
        "## Manual acceptance test",
        "",
        "1. Open V7 GIS SLD.",
        "2. Confirm the old four asset buttons are replaced by one dropdown and min/max MW inputs.",
        "3. Select Solar PV pipeline and apply min 30 MW.",
        "4. Confirm only solar projects above the selected capacity range appear.",
        "5. Select BESS pipeline and repeat.",
        "6. Confirm marker dots are no longer oversized.",
        "",
    ]), encoding="utf-8")

    print("V7 GIS SLD asset pipeline dropdown patch complete.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
