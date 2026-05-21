#!/usr/bin/env python3
"""
Replace V7 GIS SLD asset buttons with a pipeline dropdown, status dropdown and MW range filter.

This supersedes the earlier asset dropdown script.

Purpose:
- Reverse oversized operating asset marker styling.
- Use Atlas V8 REPD master data as pipeline context, not only operational assets.
- Replace four cockpit asset buttons with compact dropdown controls.
- Let users filter by technology, planning or build status and min/max MW.

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
REPORT = REPORTS / "replace_v7_gis_sld_asset_buttons_with_pipeline_dropdown_status.md"
TEST_FILE = ROOT / "scripts" / "test_v7_gis_sld_asset_pipeline_dropdown_status.py"

OLD_ASSET_ROW_START = '        <div class="map-toggle-row asset-toggle-row">'
OLD_ASSET_ROW_END = '        </div>\n    </div>\n\n    <div class="crosshair">⌖</div>'
NEW_ASSET_ROW = '''        <div class="map-toggle-row asset-toggle-row asset-filter-row">
            <select id="asset_layer_select" class="map-asset-select" title="Energy asset layer">
                <option value="off">Energy assets OFF</option>
                <option value="all">All technologies</option>
                <option value="solar_operational">Solar PV</option>
                <option value="bess_operational">BESS</option>
                <option value="wind_onshore_operational">Onshore wind</option>
                <option value="wind_offshore_operational">Offshore wind</option>
            </select>
            <select id="asset_status_select" class="map-asset-status-select" title="Project status">
                <option value="all">All statuses</option>
                <option value="operational">Operational</option>
                <option value="under construction">Under construction</option>
                <option value="awaiting construction">Awaiting construction</option>
                <option value="planning approved">Planning approved</option>
                <option value="planning submitted">Planning submitted</option>
                <option value="refused">Refused</option>
                <option value="withdrawn">Withdrawn</option>
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
    status: "all",
    minMw: null,
    maxMw: null
};'''

ASSET_FUNCTIONS = r'''function atlasV8CapacityExpression() {
    return ["to-number", ["coalesce", ["get", "capacity"], ["get", "capacity_mw"], 0]];
}

function atlasV8AssetBaseFilter(assetKey) {
    if (assetKey === "solar_operational") return ["==", ["get", "tech"], "solar"];
    if (assetKey === "bess_operational") return ["==", ["get", "tech"], "bess"];
    if (assetKey === "wind_onshore_operational") return ["==", ["get", "raw_tech"], "Wind Onshore"];
    if (assetKey === "wind_offshore_operational") return ["==", ["get", "raw_tech"], "Wind Offshore"];
    return true;
}

function atlasV8StatusExpression() {
    return ["downcase", ["to-string", ["coalesce", ["get", "status"], ["get", "Status"], ""]]];
}

function atlasV8AssetFilter(assetKey) {
    const filters = ["all", atlasV8AssetBaseFilter(assetKey)];
    const capacityExpr = atlasV8CapacityExpression();
    if (atlasV8AssetFilterState.status && atlasV8AssetFilterState.status !== "all") {
        filters.push(["==", atlasV8StatusExpression(), atlasV8AssetFilterState.status]);
    }
    if (Number.isFinite(atlasV8AssetFilterState.minMw)) filters.push([">=", capacityExpr, atlasV8AssetFilterState.minMw]);
    if (Number.isFinite(atlasV8AssetFilterState.maxMw)) filters.push(["<=", capacityExpr, atlasV8AssetFilterState.maxMw]);
    return filters;
}

function applyAtlasV8AssetDropdownFilter(selected = atlasV8AssetFilterState.selected, status = atlasV8AssetFilterState.status, minMw = atlasV8AssetFilterState.minMw, maxMw = atlasV8AssetFilterState.maxMw) {
    atlasV8AssetFilterState.selected = selected || "off";
    atlasV8AssetFilterState.status = status || "all";
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
    applyAtlasV8AssetDropdownFilter(next, atlasV8AssetFilterState.status, atlasV8AssetFilterState.minMw, atlasV8AssetFilterState.maxMw);
}

'''

RADIUS_LARGE = [
    '"circle-radius": ["interpolate", ["linear"], ["coalesce", ["get", "capacity"], 0], 0, 6, 10, 10, 29.99, 14, 30, 28, 50, 32, 100, 38, 200, 44, 350, 52, 500, 60]',
    '"circle-radius": ["interpolate", ["linear"], ["coalesce", ["get", "capacity"], 0], 0, 5, 10, 8, 29.99, 12, 30, 20, 50, 24, 100, 30, 200, 36, 350, 44, 500, 52]',
    '"circle-radius": ["interpolate", ["linear"], ["coalesce", ["get", "capacity"], 0], 0, 6, 10, 10, 29.99, 14, 30, 24, 50, 28, 100, 34, 200, 40, 350, 48, 500, 56]',
]
RADIUS_ORIGINAL = '"circle-radius": ["interpolate", ["linear"], ["coalesce", ["get", "capacity"], 0], 0, 5, 10, 7, 50, 10, 100, 13, 200, 16, 350, 20, 500, 24]'
RADIUS_RESTRAINED = '"circle-radius": ["interpolate", ["linear"], ["coalesce", ["get", "capacity"], 0], 0, 5, 10, 7, 30, 9, 50, 10, 100, 12, 200, 15, 350, 18, 500, 21]'

STATUS_REPLACEMENTS = {
    '["all", ["==", ["get", "tech"], "solar"], ["==", ["get", "status"], "operational"]]': '["all", ["==", ["get", "tech"], "solar"]]',
    '["all", ["==", ["get", "raw_tech"], "Wind Onshore"], ["==", ["get", "status"], "operational"]]': '["all", ["==", ["get", "raw_tech"], "Wind Onshore"]]',
    '["all", ["==", ["get", "raw_tech"], "Wind Offshore"], ["==", ["get", "status"], "operational"]]': '["all", ["==", ["get", "raw_tech"], "Wind Offshore"]]',
    '["all", ["==", ["get", "tech"], "bess"], ["==", ["get", "status"], "operational"]]': '["all", ["==", ["get", "tech"], "bess"]]',
}

UI_INSERT_MARKERS = [
    'function updateAtlasV8OperatingAssetToggleButtons() {',
    'function updateAtlasV8OperatingAssetDropdown() {'
]
UI_FUNCTIONS = r'''function readAssetFilterCapacityValue(id) {
    const el = $(id);
    if (!el || String(el.value || "").trim() === "") return null;
    const value = Number(el.value);
    return Number.isFinite(value) && value >= 0 ? value : null;
}

function updateAtlasV8OperatingAssetDropdown() {
    const select = $("asset_layer_select");
    if (select) select.value = atlasV8AssetFilterState?.selected || "off";
    const statusSelect = $("asset_status_select");
    if (statusSelect) statusSelect.value = atlasV8AssetFilterState?.status || "all";
    const minInput = $("asset_min_mw");
    const maxInput = $("asset_max_mw");
    if (minInput && Number.isFinite(atlasV8AssetFilterState?.minMw)) minInput.value = atlasV8AssetFilterState.minMw;
    if (maxInput && Number.isFinite(atlasV8AssetFilterState?.maxMw)) maxInput.value = atlasV8AssetFilterState.maxMw;
}

function applyAssetDropdownFromControls() {
    const selected = $("asset_layer_select")?.value || "off";
    const status = $("asset_status_select")?.value || "all";
    let minMw = readAssetFilterCapacityValue("asset_min_mw");
    let maxMw = readAssetFilterCapacityValue("asset_max_mw");
    if (Number.isFinite(minMw) && Number.isFinite(maxMw) && minMw > maxMw) {
        const temp = minMw;
        minMw = maxMw;
        maxMw = temp;
        if ($("asset_min_mw")) $("asset_min_mw").value = minMw;
        if ($("asset_max_mw")) $("asset_max_mw").value = maxMw;
    }
    applyAtlasV8AssetDropdownFilter?.(selected, status, minMw, maxMw);
    updateAtlasV8OperatingAssetDropdown();
}

function wireAtlasV8PipelineDropdownWithStatus() {
    $("asset_layer_select")?.addEventListener("change", applyAssetDropdownFromControls);
    $("asset_status_select")?.addEventListener("change", applyAssetDropdownFromControls);
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
WIRE_OPTIONS = ['wireAtlasV8OperatingAssetToggleButtons();', 'wireAtlasV8OperatingAssetDropdown();']
WIRE_NEW = 'wireAtlasV8PipelineDropdownWithStatus();'

CSS_MARKER = '/* GLOBALGRID2050 V7 ASSET PIPELINE DROPDOWN STATUS FILTER */'
CSS_PATCH = r'''

/* GLOBALGRID2050 V7 ASSET PIPELINE DROPDOWN STATUS FILTER */
.asset-filter-row {
    gap: 6px;
}
.map-asset-select,
.map-asset-status-select,
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
    min-width: 150px;
}
.map-asset-status-select {
    min-width: 160px;
    color: #00ffff;
}
.asset-range-input {
    width: 76px;
    text-align: center;
}
.map-asset-select:focus,
.map-asset-status-select:focus,
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
    .map-asset-select { min-width: 142px; max-width: 170px; }
    .map-asset-status-select { min-width: 150px; max-width: 190px; }
    .asset-range-input { width: 72px; }
}
@media (max-width: 520px) {
    .map-asset-select { width: 150px; min-width: 150px; }
    .map-asset-status-select { width: 160px; min-width: 160px; }
    .asset-range-input { width: 70px; }
}
@media print {
    .asset-filter-row { display: none !important; }
}
'''

TEST_CONTENT = r'''#!/usr/bin/env python3
"""Static checks for V7 GIS SLD asset pipeline dropdown with status filter."""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
APP = ROOT / "solar-bess-topology-v7" / "gis-sld-financial-sandbox"
index = (APP / "index.html").read_text(encoding="utf-8")
map_js = (APP / "gis-sld-v5-map.js").read_text(encoding="utf-8")
ui = (APP / "gis-sld-v5-ui.js").read_text(encoding="utf-8")
css = (APP / "gis-sld-v5.css").read_text(encoding="utf-8")

for token in ["asset_layer_select", "asset_status_select", "asset_min_mw", "asset_max_mw", "btn_asset_filter_apply"]:
    assert token in index, token
assert "asset-layer-btn" not in index, "old four asset buttons should be replaced"
for token in ["atlasV8AssetFilterState", "status: \"all\"", "atlasV8StatusExpression", "applyAtlasV8AssetDropdownFilter"]:
    assert token in map_js, token
assert '["==", ["get", "status"], "operational"]' not in map_js, "base layers should not be operational only"
assert "500, 60" not in map_js, "oversized marker radius should be removed"
for token in ["wireAtlasV8PipelineDropdownWithStatus", "asset_status_select", "applyAssetDropdownFromControls"]:
    assert token in ui, token
for token in ["map-asset-status-select", "ASSET PIPELINE DROPDOWN STATUS FILTER"]:
    assert token in css, token
print("V7 GIS SLD asset pipeline dropdown with status filter static checks passed.")
'''


def read(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def write(path: Path, text: str) -> None:
    path.write_text(text, encoding="utf-8")


def replace_asset_row(text: str) -> tuple[str, bool]:
    if 'id="asset_status_select"' in text:
        return text, False
    if 'id="asset_layer_select"' in text:
        insert = '''
            <select id="asset_status_select" class="map-asset-status-select" title="Project status">
                <option value="all">All statuses</option>
                <option value="operational">Operational</option>
                <option value="under construction">Under construction</option>
                <option value="awaiting construction">Awaiting construction</option>
                <option value="planning approved">Planning approved</option>
                <option value="planning submitted">Planning submitted</option>
                <option value="refused">Refused</option>
                <option value="withdrawn">Withdrawn</option>
            </select>'''
        marker = '            <input id="asset_min_mw"'
        if marker not in text:
            raise SystemExit("could not insert status dropdown into existing asset row")
        return text.replace(marker, insert + "\n" + marker, 1), True
    start_idx = text.find(OLD_ASSET_ROW_START)
    if start_idx < 0:
        raise SystemExit("asset row start marker not found")
    end_idx = text.find(OLD_ASSET_ROW_END, start_idx)
    if end_idx < 0:
        raise SystemExit("asset row end marker not found")
    return text[:start_idx] + NEW_ASSET_ROW + text[end_idx + len(OLD_ASSET_ROW_END):], True


def replace_asset_functions(text: str) -> tuple[str, bool]:
    if "function atlasV8StatusExpression" in text and "status: \"all\"" in text:
        return text, False
    if STATE_OLD in text and "const atlasV8AssetFilterState" not in text:
        text = text.replace(STATE_OLD, STATE_NEW, 1)
    elif "const atlasV8AssetFilterState" in text and "status:" not in text.split("const atlasV8AssetFilterState", 1)[1].split("};", 1)[0]:
        text = text.replace('selected: "off",\n    minMw: null,', 'selected: "off",\n    status: "all",\n    minMw: null,', 1)

    start_candidates = ["function atlasV8CapacityExpression()", "function toggleAtlasV8OperatingAssetLayer(assetKey) {"]
    start = -1
    for candidate in start_candidates:
        start = text.find(candidate)
        if start >= 0:
            break
    end = text.find("function toggleAtlasV8GridLayer(voltageKey)")
    if start < 0 or end < 0 or end <= start:
        raise SystemExit("asset function markers not found")
    text = text[:start] + ASSET_FUNCTIONS + "\n" + text[end:]
    return text, True


def main() -> int:
    actions: list[str] = []

    index = read(INDEX)
    index, changed = replace_asset_row(index)
    if changed: actions.append("added compact technology dropdown, status dropdown and MW range controls")
    else: actions.append("technology and status dropdowns already present")
    write(INDEX, index)

    map_js = read(MAP_JS)
    map_js, changed = replace_asset_functions(map_js)
    if changed: actions.append("added asset filtering by technology, status and MW range")
    else: actions.append("asset filtering by technology, status and MW range already present")

    replaced = 0
    for pattern in RADIUS_LARGE:
        while pattern in map_js:
            map_js = map_js.replace(pattern, RADIUS_RESTRAINED, 1)
            replaced += 1
    while RADIUS_ORIGINAL in map_js:
        map_js = map_js.replace(RADIUS_ORIGINAL, RADIUS_RESTRAINED, 1)
        replaced += 1
    actions.append(f"normalised asset marker radius expressions: {replaced}")

    for old, new in STATUS_REPLACEMENTS.items():
        map_js = map_js.replace(old, new)
    actions.append("removed operational only base filters so status dropdown controls status selection")
    write(MAP_JS, map_js)

    ui = read(UI_JS)
    if "function wireAtlasV8PipelineDropdownWithStatus" not in ui:
        marker = None
        for candidate in UI_INSERT_MARKERS:
            if candidate in ui:
                marker = candidate
                break
        if not marker:
            raise SystemExit("UI insertion marker not found")
        ui = ui.replace(marker, UI_FUNCTIONS + marker, 1)
        actions.append("added status aware asset dropdown UI functions")
    else:
        actions.append("status aware asset dropdown UI functions already present")

    if WIRE_NEW not in ui:
        for old_wire in WIRE_OPTIONS:
            if old_wire in ui:
                ui = ui.replace(old_wire, WIRE_NEW, 1)
                actions.append("wired status aware asset dropdown")
                break
        else:
            raise SystemExit("asset dropdown wire marker not found")
    else:
        actions.append("status aware asset dropdown already wired")
    write(UI_JS, ui)

    css = read(CSS)
    if CSS_MARKER not in css:
        css = css.rstrip() + CSS_PATCH + "\n"
        actions.append("added status dropdown CSS")
    else:
        actions.append("status dropdown CSS already present")
    write(CSS, css)

    write(TEST_FILE, TEST_CONTENT)
    actions.append("added static test script")

    REPORTS.mkdir(parents=True, exist_ok=True)
    REPORT.write_text("\n".join([
        "# Replace V7 GIS SLD Asset Buttons With Pipeline Dropdown Status",
        "",
        f"UTC created: {dt.datetime.now(dt.timezone.utc).isoformat()}",
        "",
        "## Purpose",
        "",
        "Replace asset buttons with compact filters for technology, project status and MW capacity range.",
        "",
        "## Behaviour",
        "",
        "- Uses Atlas V8 REPD master data across pipeline statuses.",
        "- Technology selector: OFF, all technologies, Solar PV, BESS, Onshore wind, Offshore wind.",
        "- Status selector: all statuses, operational, under construction, awaiting construction, planning approved, planning submitted, refused and withdrawn.",
        "- Capacity selector: min MW and max MW.",
        "- Marker sizes are restrained again.",
        "",
        "## Actions",
        "",
        *[f"- {a}" for a in actions],
        "",
        "## Test",
        "",
        "Run `python scripts/test_v7_gis_sld_asset_pipeline_dropdown_status.py`.",
        "",
        "## Manual acceptance test",
        "",
        "1. Open V7 GIS SLD.",
        "2. Select Solar PV and Operational.",
        "3. Enter min 30 MW and apply.",
        "4. Change status to Under construction and apply.",
        "5. Repeat with BESS, Onshore wind and Offshore wind.",
        "6. Confirm marker sizes are readable, not oversized.",
        "",
    ]), encoding="utf-8")

    print("V7 asset pipeline dropdown with status patch complete.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
