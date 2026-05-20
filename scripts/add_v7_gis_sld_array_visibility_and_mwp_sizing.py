#!/usr/bin/env python3
"""
Add V7 GIS SLD array visibility toggle and target MWp DC sizing control.

Scope:
- V7 GIS SLD only.
- Adds ARRAY ON/OFF map toggle so users can explore the map without the drawn array.
- Adds target DC MWp inputs for String and Central tabs.
- Adds compact map overlay target MWp DC input and SIZE MWp button.
- Applies sizing by whole repeatable blocks only.
- Does not modify modules per string, module rating, inverter rating or central DC input rating.
"""

from __future__ import annotations

import datetime as dt
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
APP = ROOT / "solar-bess-topology-v7" / "gis-sld-financial-sandbox"
REPORTS = ROOT / "gridbot_reports"
REPORT = REPORTS / "add_v7_gis_sld_array_visibility_and_mwp_sizing.md"

INDEX = APP / "index.html"
STATE = APP / "gis-sld-v5-state.js"
UI = APP / "gis-sld-v5-ui.js"
CSS = APP / "gis-sld-v5.css"

ARRAY_BUTTON_MARKER = '<button id="btn_key_toggle" class="map-toggle-btn active">KEY ON</button>'
ARRAY_BUTTON = '<button id="btn_array_toggle" class="map-toggle-btn active">ARRAY ON</button>'

STRING_MARKER = '<h3>Array Hierarchy (String)</h3>'
STRING_TARGET = '''<h3>Array Hierarchy (String)</h3>
        <div class="input-group array-size-control"><label>Target DC Capacity MWp</label><input type="number" id="target_dc_mwp" value="" placeholder="Optional" step="1" min="0.1" /></div>
        <div class="ux-note array-size-note">Optional sizing helper. Enter a target MWp DC and the sandbox will resize by whole skid and ring main steps. Module rating, modules per string, strings per inverter and inverter rating remain user controlled.</div>'''

CENTRAL_MARKER = '<h3>Array Hierarchy (Central)</h3>'
CENTRAL_TARGET = '''<h3>Array Hierarchy (Central)</h3>
        <div class="input-group array-size-control"><label>Target DC Capacity MWp</label><input type="number" id="target_dc_mwp_c" value="" placeholder="Optional" step="1" min="0.1" /></div>
        <div class="ux-note array-size-note">Optional sizing helper. Enter a target MWp DC and the sandbox will resize by whole central inverter, skid and ring main steps. Module rating, modules per string and central inverter ratings remain user controlled.</div>'''

MAP_SIZE_MARKER = '''    <div class="map-toggle-row">
        <button id="btn_map_tools_toggle" class="map-toggle-btn active">TOOLS ON</button>
        <button id="btn_map_draw" class="map-toggle-btn">DRAW</button>
        <button id="btn_map_pick_array" class="map-toggle-btn">PICK ARRAY</button>
        <button id="btn_map_drop_pins" class="map-toggle-btn">DROP PINS</button>
        <button id="btn_map_draw_route" class="map-toggle-btn">DRAW ROUTE</button>
    </div>'''
MAP_SIZE_BLOCK = '''    <div class="map-toggle-row">
        <button id="btn_map_tools_toggle" class="map-toggle-btn active">TOOLS ON</button>
        <button id="btn_map_draw" class="map-toggle-btn">DRAW</button>
        <button id="btn_map_pick_array" class="map-toggle-btn">PICK ARRAY</button>
        <button id="btn_map_drop_pins" class="map-toggle-btn">DROP PINS</button>
        <button id="btn_map_draw_route" class="map-toggle-btn">DRAW ROUTE</button>
    </div>
    <div class="map-toggle-row map-size-row">
        <input id="map_target_dc_mwp" class="map-size-input" type="number" min="0.1" step="1" placeholder="MWp DC" />
        <button id="btn_map_apply_size" class="map-toggle-btn">SIZE MWp</button>
        <span id="map_size_status" class="map-size-status">Whole block sizing</span>
    </div>'''

STATE_MARKER = '    suppressNextMapFit: false,\n'
STATE_PATCH = '    suppressNextMapFit: false,\n    arrayVisible: true,\n'

UI_MARKER = '// ============================================================\n// BASEMAP / SUBS TOGGLES\n// ============================================================'
UI_PATCH = r'''
// ============================================================
// ARRAY VISIBILITY AND TARGET MWp SIZING
// ============================================================
const TOPOLOGY_LAYER_IDS_FOR_ARRAY_TOGGLE = [
    "overall_boundary_fill",
    "overall_boundary_line",
    "footprints",
    "footprints_outline",
    "export_cable",
    "radial_spine",
    "export_cable_pins",
    "inverters",
    "substation"
];

function setTopologyLayerVisibility(visible) {
    if (!map) return;
    TOPOLOGY_LAYER_IDS_FOR_ARRAY_TOGGLE.forEach(layerId => {
        if (map.getLayer(layerId)) {
            map.setLayoutProperty(layerId, "visibility", visible ? "visible" : "none");
        }
    });
}

function updateArrayToggleButton() {
    const btn = $("btn_array_toggle");
    if (!btn) return;
    const visible = state.arrayVisible !== false;
    btn.textContent = visible ? "ARRAY ON" : "ARRAY OFF";
    btn.classList.toggle("active", visible);
}

function toggleArrayVisibility() {
    state.arrayVisible = state.arrayVisible === false;
    setTopologyLayerVisibility(state.arrayVisible !== false);
    updateArrayToggleButton();
}

function syncMapSizeInputFromActiveTab() {
    const mapInput = $("map_target_dc_mwp");
    if (!mapInput) return;
    const source = state.activeTab === "string" ? $("target_dc_mwp") : $("target_dc_mwp_c");
    mapInput.value = source?.value || "";
}

function setMapSizeStatus(text, ok = true) {
    const el = $("map_size_status");
    if (!el) return;
    el.textContent = text;
    el.style.color = ok ? "#00ff88" : "#ff9900";
}

function setInputValue(id, value) {
    const el = $(id);
    if (!el) return;
    el.value = String(value);
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
}

function applyTargetDcMwpFromActiveTab(source) {
    const suffix = state.activeTab === "string" ? "" : "_c";
    const targetInput = state.activeTab === "string" ? $("target_dc_mwp") : $("target_dc_mwp_c");
    const mapInput = $("map_target_dc_mwp");
    const raw = source === "map" ? parseFloat(mapInput?.value) : parseFloat(targetInput?.value);
    const targetMwp = Number.isFinite(raw) && raw > 0 ? raw : 0;

    if (!targetMwp) {
        setMapSizeStatus("Enter MWp DC", false);
        return;
    }

    if (state.activeTab === "string") {
        const modWp = num("mod_wp");
        const x = intVal("x_mods");
        const z = intVal("z_strings");
        const y = intVal("y_invs");
        const currentSkidsPerRing = Math.max(1, intVal("s_subs", 1));
        if (modWp <= 0 || x <= 0 || z <= 0 || y <= 0) {
            setMapSizeStatus("Check string inputs", false);
            return;
        }
        const dcPerSkidMwp = (modWp * x * z * y) / 1_000_000;
        const desiredSkids = Math.max(1, Math.ceil(targetMwp / dcPerSkidMwp));
        const rings = Math.max(1, Math.ceil(desiredSkids / currentSkidsPerRing));
        const skidsPerRing = Math.max(1, Math.ceil(desiredSkids / rings));
        const actualSkids = skidsPerRing * rings;
        const actualMwp = actualSkids * dcPerSkidMwp;

        setInputValue("s_subs", skidsPerRing);
        setInputValue("b_cols", rings);
        if (targetInput) targetInput.value = targetMwp;
        if (mapInput) mapInput.value = targetMwp;
        setMapSizeStatus(`String ${actualMwp.toFixed(1)} MWp via ${actualSkids} skids`, true);
    } else {
        const invDcMwp = getCentralInverterDcMwdc();
        const invPerSkid = Math.max(1, intVal("inv_per_mv_c", 1));
        const currentSkidsPerRing = Math.max(1, intVal("mv_per_ring_c", 1));
        if (invDcMwp <= 0 || invPerSkid <= 0) {
            setMapSizeStatus("Check central inputs", false);
            return;
        }
        const desiredInverters = Math.max(1, Math.ceil(targetMwp / invDcMwp));
        const desiredSkids = Math.max(1, Math.ceil(desiredInverters / invPerSkid));
        const rings = Math.max(1, Math.ceil(desiredSkids / currentSkidsPerRing));
        const skidsPerRing = Math.max(1, Math.ceil(desiredSkids / rings));
        const actualInverters = invPerSkid * skidsPerRing * rings;
        const actualMwp = actualInverters * invDcMwp;

        setInputValue("mv_per_ring_c", skidsPerRing);
        setInputValue("rings_c", rings);
        if (targetInput) targetInput.value = targetMwp;
        if (mapInput) mapInput.value = targetMwp;
        setMapSizeStatus(`Central ${actualMwp.toFixed(1)} MWp via ${actualInverters} inverter blocks`, true);
    }

    state.arrayOverrideCenter = null;
    state.suppressNextMapFit = true;
    redrawIfTopologyExists();
    setTopologyLayerVisibility(state.arrayVisible !== false);
    updateArrayToggleButton();
}

function wireArraySizingControls() {
    $("btn_array_toggle")?.addEventListener("click", toggleArrayVisibility);
    $("btn_map_apply_size")?.addEventListener("click", () => applyTargetDcMwpFromActiveTab("map"));
    $("map_target_dc_mwp")?.addEventListener("keydown", e => {
        if (e.key === "Enter") applyTargetDcMwpFromActiveTab("map");
    });
    $("target_dc_mwp")?.addEventListener("change", () => applyTargetDcMwpFromActiveTab("panel"));
    $("target_dc_mwp_c")?.addEventListener("change", () => applyTargetDcMwpFromActiveTab("panel"));
    updateArrayToggleButton();
    syncMapSizeInputFromActiveTab();
}

'''

SWITCH_MARKER = '    updateLegend();\n    if (state.activeDrawCenter) computeAndDraw();'
SWITCH_PATCH = '    updateLegend();\n    syncMapSizeInputFromActiveTab?.();\n    if (state.activeDrawCenter) computeAndDraw();'

WIRE_MARKER = 'wireMapToolOverlayButtons();'
WIRE_PATCH = 'wireMapToolOverlayButtons();\nwireArraySizingControls();'

DRAW_VIS_MARKER = '    if (src) src.setData(state.currentGeoJSON);\n'
DRAW_VIS_PATCH = '    if (src) src.setData(state.currentGeoJSON);\n    setTopologyLayerVisibility?.(state.arrayVisible !== false);\n    updateArrayToggleButton?.();\n'

CSS_MARKER = '/* GLOBALGRID2050 V7 ARRAY VISIBILITY AND MWp SIZING */'
CSS_PATCH = r'''

/* GLOBALGRID2050 V7 ARRAY VISIBILITY AND MWp SIZING */
.array-size-control input {
    color: var(--accent);
    font-weight: bold;
}
.array-size-note {
    border-left: 2px solid var(--accent);
    padding-left: 8px;
    margin-bottom: 10px;
}
.map-size-row {
    align-items: center;
}
.map-size-input {
    width: 90px;
    min-width: 90px;
    padding: 8px 10px;
    background: rgba(0, 0, 0, 0.82);
    border: 1px solid #2f343d;
    border-radius: 4px;
    color: #00ffff;
    font-family: "Courier New", monospace;
    font-size: 12px;
    font-weight: bold;
}
.map-size-input:focus {
    outline: none;
    border-color: #00ffff;
}
.map-size-status {
    color: #a6adbb;
    font-size: 10px;
    font-weight: bold;
    padding: 8px 4px;
    white-space: nowrap;
}
#btn_array_toggle.active {
    border-color: #00ff88;
    color: #00ff88;
}
#btn_array_toggle:not(.active) {
    opacity: 0.55;
}
@media (max-width: 768px) {
    .map-size-row {
        display: flex;
        flex-wrap: wrap;
    }
    .map-size-input {
        width: 82px;
        min-width: 82px;
    }
    .map-size-status {
        width: 100%;
    }
}
@media print {
    .map-size-row,
    .array-size-note {
        display: none !important;
    }
}
'''

TEST_FILE = ROOT / "scripts" / "test_v7_gis_sld_array_sizing_math.py"
TEST_CONTENT = r'''#!/usr/bin/env python3
"""Static and maths checks for V7 GIS SLD array MWp sizing."""
from __future__ import annotations

import math
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
APP = ROOT / "solar-bess-topology-v7" / "gis-sld-financial-sandbox"


def string_sizing(target_mwp, mod_wp, x_mods, z_strings, y_invs, current_skids_per_ring):
    dc_per_skid = (mod_wp * x_mods * z_strings * y_invs) / 1_000_000
    desired_skids = max(1, math.ceil(target_mwp / dc_per_skid))
    rings = max(1, math.ceil(desired_skids / current_skids_per_ring))
    skids_per_ring = max(1, math.ceil(desired_skids / rings))
    actual_skids = skids_per_ring * rings
    actual_mwp = actual_skids * dc_per_skid
    return dc_per_skid, desired_skids, skids_per_ring, rings, actual_skids, actual_mwp


def central_sizing(target_mwp, inv_dc_mwp, inv_per_skid, current_skids_per_ring):
    desired_inverters = max(1, math.ceil(target_mwp / inv_dc_mwp))
    desired_skids = max(1, math.ceil(desired_inverters / inv_per_skid))
    rings = max(1, math.ceil(desired_skids / current_skids_per_ring))
    skids_per_ring = max(1, math.ceil(desired_skids / rings))
    actual_inverters = inv_per_skid * skids_per_ring * rings
    actual_mwp = actual_inverters * inv_dc_mwp
    return desired_inverters, desired_skids, skids_per_ring, rings, actual_inverters, actual_mwp


def main():
    index = (APP / "index.html").read_text(encoding="utf-8")
    ui = (APP / "gis-sld-v5-ui.js").read_text(encoding="utf-8")
    drawing = (APP / "gis-sld-v5-drawing.js").read_text(encoding="utf-8")
    state = (APP / "gis-sld-v5-state.js").read_text(encoding="utf-8")

    for token in ["btn_array_toggle", "map_target_dc_mwp", "target_dc_mwp", "target_dc_mwp_c"]:
        assert token in index, token
    for token in ["toggleArrayVisibility", "applyTargetDcMwpFromActiveTab", "wireArraySizingControls"]:
        assert token in ui, token
    assert "arrayVisible: true" in state
    assert "setTopologyLayerVisibility?.(state.arrayVisible !== false);" in drawing

    # Default string mode maths: 660 W, 28 modules, 18 strings, 28 inverters.
    dc_per_skid, desired_skids, skids_per_ring, rings, actual_skids, actual_mwp = string_sizing(
        100, 660, 28, 18, 28, 5
    )
    assert round(dc_per_skid, 6) == round((660 * 28 * 18 * 28) / 1_000_000, 6)
    assert actual_skids >= desired_skids
    assert actual_mwp >= 100
    assert skids_per_ring >= 1 and rings >= 1

    # Default central mode maths: 5.28 MWdc inverter, 1 inverter per skid, 4 skids per ring.
    desired_inv, desired_skids, skids_per_ring, rings, actual_inv, actual_mwp = central_sizing(
        100, 5.28, 1, 4
    )
    assert actual_inv >= desired_inv
    assert actual_mwp >= 100
    assert skids_per_ring >= 1 and rings >= 1

    print("V7 GIS SLD array sizing static and maths checks passed.")


if __name__ == "__main__":
    main()
'''


def read(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def write(path: Path, text: str) -> None:
    path.write_text(text, encoding="utf-8")


def replace_once(text: str, old: str, new: str, label: str) -> tuple[str, bool]:
    if new in text:
        return text, False
    if old not in text:
        raise SystemExit(f"Marker not found: {label}")
    return text.replace(old, new, 1), True


def main() -> int:
    actions: list[str] = []

    index = read(INDEX)
    index, changed = replace_once(index, ARRAY_BUTTON_MARKER, ARRAY_BUTTON_MARKER + "\n" + ARRAY_BUTTON, "array toggle button")
    if changed: actions.append("added ARRAY ON/OFF map toggle")
    index, changed = replace_once(index, STRING_MARKER, STRING_TARGET, "string target MWp input")
    if changed: actions.append("added string target DC MWp input")
    index, changed = replace_once(index, CENTRAL_MARKER, CENTRAL_TARGET, "central target MWp input")
    if changed: actions.append("added central target DC MWp input")
    index, changed = replace_once(index, MAP_SIZE_MARKER, MAP_SIZE_BLOCK, "map MWp sizing row")
    if changed: actions.append("added map overlay MWp sizing control")
    write(INDEX, index)

    state = read(STATE)
    state, changed = replace_once(state, STATE_MARKER, STATE_PATCH, "arrayVisible state")
    if changed: actions.append("added arrayVisible state")
    write(STATE, state)

    ui = read(UI)
    ui, changed = replace_once(ui, UI_MARKER, UI_PATCH + UI_MARKER, "array sizing UI functions")
    if changed: actions.append("added array visibility and target MWp sizing functions")
    ui, changed = replace_once(ui, SWITCH_MARKER, SWITCH_PATCH, "tab switch sync")
    if changed: actions.append("synced map MWp input when switching tabs")
    ui, changed = replace_once(ui, WIRE_MARKER, WIRE_PATCH, "wire array sizing controls")
    if changed: actions.append("wired array toggle and MWp sizing controls")
    write(UI, ui)

    drawing_path = APP / "gis-sld-v5-drawing.js"
    drawing = read(drawing_path)
    drawing, changed = replace_once(drawing, DRAW_VIS_MARKER, DRAW_VIS_PATCH, "topology visibility after redraw")
    if changed: actions.append("preserved array visibility after redraw")
    write(drawing_path, drawing)

    css = read(CSS)
    if CSS_MARKER not in css:
        css = css.rstrip() + CSS_PATCH + "\n"
        write(CSS, css)
        actions.append("added CSS for array toggle and MWp sizing controls")
    else:
        actions.append("CSS already present")

    write(TEST_FILE, TEST_CONTENT)
    actions.append("added static and maths test script")

    REPORTS.mkdir(parents=True, exist_ok=True)
    timestamp = dt.datetime.now(dt.timezone.utc).isoformat()
    report = "\n".join([
        "# Add V7 GIS SLD Array Visibility And MWp Sizing",
        "",
        f"UTC created: {timestamp}",
        "",
        "## Purpose",
        "",
        "Add an array visibility toggle and target MWp DC sizing helper to the V7 GIS SLD map workflow.",
        "",
        "## Behaviour",
        "",
        "- ARRAY ON/OFF hides or shows the generated topology layers so users can explore the map cleanly.",
        "- String mode target MWp adjusts whole skids and 33 kV ring count.",
        "- Central mode target MWp adjusts whole central inverter/skid/ring count.",
        "- Module rating, modules per string, strings per inverter, inverter ratings and central inverter DC input remain user controlled.",
        "- Map overlay includes a compact MWp DC input and SIZE MWp button.",
        "",
        "## Actions",
        "",
        *[f"- {a}" for a in actions],
        "",
        "## Test",
        "",
        "Run `python scripts/test_v7_gis_sld_array_sizing_math.py`.",
        "",
        "## Manual acceptance test",
        "",
        "1. Open V7 GIS SLD.",
        "2. Draw an array.",
        "3. Toggle ARRAY OFF and confirm the map can be explored without the generated array.",
        "4. Toggle ARRAY ON and confirm the array returns.",
        "5. In String mode, enter target MWp DC and confirm skids/rings update without changing modules per string.",
        "6. In Central mode, enter target MWp DC and confirm central blocks/rings update without changing modules per string or central inverter DC input.",
        "",
    ])
    write(REPORT, report)
    print("V7 array visibility and MWp sizing patch ready.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
