#!/usr/bin/env python3
"""
Add operating renewable and storage asset layers to V6 and V7 GIS SLD.

Adds separate default OFF toggles for:
- Solar PV operating projects
- Onshore wind operating projects
- Offshore wind operating projects
- Battery storage operating projects

The filters are based on the existing Atlas V8 REPD layer definitions.
"""

from __future__ import annotations

import datetime as dt
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
REPORTS = ROOT / "gridbot_reports"
REPORT = REPORTS / "add_v6_v7_gis_sld_operating_asset_layers.md"

TARGETS = [
    ROOT / "solar-bess-topology-v6" / "gis-sld-financial-sandbox",
    ROOT / "solar-bess-topology-v7" / "gis-sld-financial-sandbox",
]

ASSET_STATE_MARKER = "const atlasV8OperatingAssetVisibility ="
ASSET_STATE_JS = r'''

const atlasV8OperatingAssetVisibility = {
    "solar_operational": false,
    "wind_onshore_operational": false,
    "wind_offshore_operational": false,
    "bess_operational": false
};

const atlasV8OperatingAssetLayerIds = {
    "solar_operational": "atlas-v8-asset-solar-operational",
    "wind_onshore_operational": "atlas-v8-asset-wind-onshore-operational",
    "wind_offshore_operational": "atlas-v8-asset-wind-offshore-operational",
    "bess_operational": "atlas-v8-asset-bess-operational"
};

function toggleAtlasV8OperatingAssetLayer(assetKey) {
    if (!atlasV8OperatingAssetLayerIds[assetKey]) return;
    atlasV8OperatingAssetVisibility[assetKey] = !atlasV8OperatingAssetVisibility[assetKey];
    const layerId = atlasV8OperatingAssetLayerIds[assetKey];
    if (map && map.getLayer(layerId)) {
        map.setLayoutProperty(layerId, "visibility", atlasV8OperatingAssetVisibility[assetKey] ? "visible" : "none");
    }
    updateLegend?.();
}
'''

ASSET_LAYERS_MARKER = '    map.addSource("topology", { type: "geojson", data: state.currentGeoJSON });'
ASSET_LAYERS_JS = r'''

    // Atlas V8 operating asset visibility layers from REPD master data.
    // These are existing operating asset context layers only.
    // They help users inspect nearby operating solar, wind and battery assets before drawing a new array.
    map.addSource("atlas-v8-repd-operating-assets", {
        type: "geojson",
        data: "/dist/repd_master.json"
    });

    map.addLayer({
        id: "atlas-v8-asset-solar-operational",
        type: "circle",
        source: "atlas-v8-repd-operating-assets",
        filter: ["all", ["==", ["get", "tech"], "solar"], ["==", ["get", "status"], "operational"]],
        layout: { visibility: atlasV8OperatingAssetVisibility["solar_operational"] ? "visible" : "none" },
        paint: {
            "circle-color": "#00ff88",
            "circle-radius": ["interpolate", ["linear"], ["coalesce", ["get", "capacity"], 0], 0, 5, 10, 7, 50, 10, 100, 13, 200, 16, 350, 20, 500, 24],
            "circle-stroke-color": "#111111",
            "circle-stroke-width": 1,
            "circle-opacity": 0.88
        }
    });

    map.addLayer({
        id: "atlas-v8-asset-wind-onshore-operational",
        type: "circle",
        source: "atlas-v8-repd-operating-assets",
        filter: ["all", ["==", ["get", "raw_tech"], "Wind Onshore"], ["==", ["get", "status"], "operational"]],
        layout: { visibility: atlasV8OperatingAssetVisibility["wind_onshore_operational"] ? "visible" : "none" },
        paint: {
            "circle-color": "#00ffcc",
            "circle-radius": ["interpolate", ["linear"], ["coalesce", ["get", "capacity"], 0], 0, 5, 10, 7, 50, 10, 100, 13, 200, 16, 350, 20, 500, 24],
            "circle-stroke-color": "#111111",
            "circle-stroke-width": 1,
            "circle-opacity": 0.88
        }
    });

    map.addLayer({
        id: "atlas-v8-asset-wind-offshore-operational",
        type: "circle",
        source: "atlas-v8-repd-operating-assets",
        filter: ["all", ["==", ["get", "raw_tech"], "Wind Offshore"], ["==", ["get", "status"], "operational"]],
        layout: { visibility: atlasV8OperatingAssetVisibility["wind_offshore_operational"] ? "visible" : "none" },
        paint: {
            "circle-color": "#0066ff",
            "circle-radius": ["interpolate", ["linear"], ["coalesce", ["get", "capacity"], 0], 0, 5, 10, 7, 50, 10, 100, 13, 200, 16, 350, 20, 500, 24],
            "circle-stroke-color": "#ffffff",
            "circle-stroke-width": 1,
            "circle-opacity": 0.88
        }
    });

    map.addLayer({
        id: "atlas-v8-asset-bess-operational",
        type: "circle",
        source: "atlas-v8-repd-operating-assets",
        filter: ["all", ["==", ["get", "tech"], "bess"], ["==", ["get", "status"], "operational"]],
        layout: { visibility: atlasV8OperatingAssetVisibility["bess_operational"] ? "visible" : "none" },
        paint: {
            "circle-color": "#ff69b4",
            "circle-radius": ["interpolate", ["linear"], ["coalesce", ["get", "capacity"], 0], 0, 5, 10, 7, 50, 10, 100, 13, 200, 16, 350, 20, 500, 24],
            "circle-stroke-color": "#111111",
            "circle-stroke-width": 1,
            "circle-opacity": 0.9
        }
    });

'''

ASSET_CLICK_MARKER = '    map.on("click", "substation", onPoiClick);\n    map.on("mouseenter", "substation", () => map.getCanvas().style.cursor = "pointer");\n    map.on("mouseleave", "substation", () => map.getCanvas().style.cursor = "");'
ASSET_CLICK_JS = r'''

    ["atlas-v8-asset-solar-operational", "atlas-v8-asset-wind-onshore-operational", "atlas-v8-asset-wind-offshore-operational", "atlas-v8-asset-bess-operational"].forEach(layerId => {
        map.on("click", layerId, onOperatingAssetClick);
        map.on("mouseenter", layerId, () => map.getCanvas().style.cursor = "pointer");
        map.on("mouseleave", layerId, () => map.getCanvas().style.cursor = "");
    });'''

OPERATING_ASSET_POPUP_MARKER = "function onPoiClick(e) {"
OPERATING_ASSET_POPUP_JS = r'''
function onOperatingAssetClick(e) {
    const feature = e.features && e.features[0];
    if (!feature || !feature.geometry) return;
    const prop = feature.properties || {};
    const coords = feature.geometry.coordinates.slice();
    const name = pickProp(prop, ["name", "project", "Project Name", "site", "Site Name", "ref_name"], "Operating asset");
    const tech = pickProp(prop, ["raw_tech", "tech", "technology", "Technology Type"], "Unknown technology");
    const status = pickProp(prop, ["status", "Status"], "Unknown status");
    const capacity = pickProp(prop, ["capacity", "capacity_mw", "Installed Capacity (MWelec)", "Capacity (MW)"], "n/a");
    showPopup(coords, `
        <div style="margin-bottom:5px;color:#00ff88;font-weight:bold;font-size:13px;text-transform:uppercase;">Operating Asset</div>
        <div class="popup-row"><span>Name:</span><span class="popup-val" style="color:#fff;">${name}</span></div>
        <div class="popup-row"><span>Technology:</span><span class="popup-val" style="color:#fff;">${tech}</span></div>
        <div class="popup-row"><span>Status:</span><span class="popup-val" style="color:#fff;">${status}</span></div>
        <div class="popup-row"><span>Capacity:</span><span class="popup-val" style="color:#fff;">${capacity} MW</span></div>
    `);
}

'''

BUTTON_MARKER = '''        <div class="map-toggle-row voltage-toggle-row">
            <button id="btn_atlas_66kv" class="map-toggle-btn active atlas-voltage-btn atlas-66kv" data-atlas-voltage="66kv">66 kV ON</button>
            <button id="btn_atlas_132kv" class="map-toggle-btn active atlas-voltage-btn atlas-132kv" data-atlas-voltage="132kv">132 kV ON</button>
            <button id="btn_atlas_275kv" class="map-toggle-btn active atlas-voltage-btn atlas-275kv" data-atlas-voltage="275kv">275 kV ON</button>
            <button id="btn_atlas_400kv" class="map-toggle-btn active atlas-voltage-btn atlas-400kv" data-atlas-voltage="400kv">400 kV ON</button>
        </div>'''
ASSET_BUTTONS = '''
        <div class="map-toggle-row asset-toggle-row">
            <button id="btn_asset_solar_operational" class="map-toggle-btn asset-layer-btn asset-solar" data-asset-layer="solar_operational">SOLAR OP OFF</button>
            <button id="btn_asset_wind_onshore_operational" class="map-toggle-btn asset-layer-btn asset-wind-onshore" data-asset-layer="wind_onshore_operational">ONSHORE WIND OFF</button>
            <button id="btn_asset_wind_offshore_operational" class="map-toggle-btn asset-layer-btn asset-wind-offshore" data-asset-layer="wind_offshore_operational">OFFSHORE WIND OFF</button>
            <button id="btn_asset_bess_operational" class="map-toggle-btn asset-layer-btn asset-bess" data-asset-layer="bess_operational">BESS OP OFF</button>
        </div>'''

UI_INSERT_MARKER = "function wireAtlasV8GridToggleButtons() {"
UI_ASSET_FUNCTIONS = r'''
function updateAtlasV8OperatingAssetToggleButtons() {
    const labels = {
        "solar_operational": "SOLAR OP",
        "wind_onshore_operational": "ONSHORE WIND",
        "wind_offshore_operational": "OFFSHORE WIND",
        "bess_operational": "BESS OP"
    };
    Object.keys(labels).forEach(assetKey => {
        const btn = $(`btn_asset_${assetKey}`);
        if (!btn) return;
        const visible = atlasV8OperatingAssetVisibility?.[assetKey] === true;
        btn.textContent = `${labels[assetKey]} ${visible ? "ON" : "OFF"}`;
        btn.classList.toggle("active", visible);
    });
}

function wireAtlasV8OperatingAssetToggleButtons() {
    document.querySelectorAll(".asset-layer-btn").forEach(btn => {
        btn.addEventListener("click", () => {
            toggleAtlasV8OperatingAssetLayer(btn.dataset.assetLayer);
            updateAtlasV8OperatingAssetToggleButtons();
        });
    });
    updateAtlasV8OperatingAssetToggleButtons();
}

'''
WIRE_ASSET_MARKER = "wireAtlasV8GridToggleButtons();"
WIRE_ASSET_LINE = "wireAtlasV8OperatingAssetToggleButtons();"

LEGEND_FUNCTION_MARKER = "function updateLegend() {"
LEGEND_ASSET_FUNCTION = r'''
function atlasV8AssetLegendItem(assetKey, label, colour) {
    const visible = atlasV8OperatingAssetVisibility?.[assetKey] === true;
    const opacity = visible ? "1" : "0.35";
    const suffix = visible ? "" : " OFF";
    return `<div class="legend-item" onclick="toggleAtlasV8OperatingAssetLayer('${assetKey}'); updateAtlasV8OperatingAssetToggleButtons?.();" style="cursor:pointer; opacity:${opacity};" title="Tap to toggle ${label}"><div class="swatch" style="background:${colour}; border-color:#111;"></div> ${label}${suffix}</div>`;
}

'''
LEGEND_INSERT_MARKER = '''        ${atlasV8LegendItem("400kv", "Atlas V8 400 kV Lines", "#ff3333", 3)}


        <div class="legend-item"><div class="swatch" style="background:var(--substation);"></div> Point of Interconnection</div>'''
LEGEND_INSERT_REPLACEMENT = '''        ${atlasV8LegendItem("400kv", "Atlas V8 400 kV Lines", "#ff3333", 3)}
        ${atlasV8AssetLegendItem("solar_operational", "Operating Solar PV", "#00ff88")}
        ${atlasV8AssetLegendItem("wind_onshore_operational", "Operating Onshore Wind", "#00ffcc")}
        ${atlasV8AssetLegendItem("wind_offshore_operational", "Operating Offshore Wind", "#0066ff")}
        ${atlasV8AssetLegendItem("bess_operational", "Operating Battery Storage", "#ff69b4")}


        <div class="legend-item"><div class="swatch" style="background:var(--substation);"></div> Point of Interconnection</div>'''

CSS_MARKER = "/* GLOBALGRID2050 OPERATING ASSET LAYER BUTTONS */"
CSS_PATCH = r'''

/* GLOBALGRID2050 OPERATING ASSET LAYER BUTTONS */
.asset-toggle-row {
    margin-top: 6px;
}
.asset-layer-btn {
    opacity: 0.5;
}
.asset-layer-btn.active {
    opacity: 1;
}
.asset-solar.active {
    border-color: #00ff88;
    color: #00ff88;
}
.asset-wind-onshore.active {
    border-color: #00ffcc;
    color: #00ffcc;
}
.asset-wind-offshore.active {
    border-color: #0066ff;
    color: #66aaff;
}
.asset-bess.active {
    border-color: #ff69b4;
    color: #ff69b4;
}
@media print {
    .asset-toggle-row {
        display: none !important;
    }
}
'''


def read(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def write(path: Path, text: str) -> None:
    path.write_text(text, encoding="utf-8")


def patch_once(text: str, marker: str, replacement: str, label: str) -> tuple[str, bool]:
    if replacement.strip() in text:
        return text, False
    if marker not in text:
        raise SystemExit(f"Marker not found for {label}")
    return text.replace(marker, replacement, 1), True


def patch_folder(folder: Path) -> list[str]:
    actions: list[str] = []
    index = folder / "index.html"
    map_js = folder / "gis-sld-v5-map.js"
    ui_js = folder / "gis-sld-v5-ui.js"
    ui_core_js = folder / "gis-sld-v5-ui-core.js"
    css = folder / "gis-sld-v5.css"

    for path in [index, map_js, ui_js, ui_core_js, css]:
        if not path.exists():
            raise SystemExit(f"Missing file: {path.relative_to(ROOT)}")

    map_text = read(map_js)
    if ASSET_STATE_MARKER not in map_text:
        map_text = map_text.replace("};\n\nfunction toggleAtlasV8GridLayer", "};" + ASSET_STATE_JS + "\nfunction toggleAtlasV8GridLayer", 1)
        actions.append(f"added operating asset visibility state in {map_js.relative_to(ROOT)}")
    else:
        actions.append(f"operating asset visibility state already present in {map_js.relative_to(ROOT)}")

    if "atlas-v8-repd-operating-assets" not in map_text:
        if ASSET_LAYERS_MARKER not in map_text:
            raise SystemExit(f"Asset layer marker not found in {map_js.relative_to(ROOT)}")
        map_text = map_text.replace(ASSET_LAYERS_MARKER, ASSET_LAYERS_JS + ASSET_LAYERS_MARKER, 1)
        actions.append(f"added operating asset layers in {map_js.relative_to(ROOT)}")
    else:
        actions.append(f"operating asset layers already present in {map_js.relative_to(ROOT)}")

    if "function onOperatingAssetClick" not in map_text:
        if OPERATING_ASSET_POPUP_MARKER not in map_text:
            raise SystemExit(f"Operating asset popup marker not found in {map_js.relative_to(ROOT)}")
        map_text = map_text.replace(OPERATING_ASSET_POPUP_MARKER, OPERATING_ASSET_POPUP_JS + OPERATING_ASSET_POPUP_MARKER, 1)
        actions.append(f"added operating asset popup handler in {map_js.relative_to(ROOT)}")
    else:
        actions.append(f"operating asset popup handler already present in {map_js.relative_to(ROOT)}")

    if "atlas-v8-asset-solar-operational" in map_text and "onOperatingAssetClick" in map_text and "map.on(\"click\", layerId, onOperatingAssetClick);" not in map_text:
        if ASSET_CLICK_MARKER not in map_text:
            raise SystemExit(f"Operating asset click marker not found in {map_js.relative_to(ROOT)}")
        map_text = map_text.replace(ASSET_CLICK_MARKER, ASSET_CLICK_MARKER + ASSET_CLICK_JS, 1)
        actions.append(f"wired operating asset click handlers in {map_js.relative_to(ROOT)}")
    elif "map.on(\"click\", layerId, onOperatingAssetClick);" in map_text:
        actions.append(f"operating asset click handlers already wired in {map_js.relative_to(ROOT)}")

    write(map_js, map_text)

    index_text = read(index)
    if "asset-toggle-row" not in index_text:
        if BUTTON_MARKER not in index_text:
            raise SystemExit(f"Asset button marker not found in {index.relative_to(ROOT)}")
        index_text = index_text.replace(BUTTON_MARKER, BUTTON_MARKER + ASSET_BUTTONS, 1)
        write(index, index_text)
        actions.append(f"added operating asset toggle buttons in {index.relative_to(ROOT)}")
    else:
        actions.append(f"operating asset toggle buttons already present in {index.relative_to(ROOT)}")

    ui_text = read(ui_js)
    if "function updateAtlasV8OperatingAssetToggleButtons" not in ui_text:
        if UI_INSERT_MARKER not in ui_text:
            raise SystemExit(f"UI asset function marker not found in {ui_js.relative_to(ROOT)}")
        ui_text = ui_text.replace(UI_INSERT_MARKER, UI_ASSET_FUNCTIONS + UI_INSERT_MARKER, 1)
        actions.append(f"added operating asset toggle UI functions in {ui_js.relative_to(ROOT)}")
    else:
        actions.append(f"operating asset toggle UI functions already present in {ui_js.relative_to(ROOT)}")

    if WIRE_ASSET_LINE not in ui_text:
        if WIRE_ASSET_MARKER not in ui_text:
            raise SystemExit(f"UI wire marker not found in {ui_js.relative_to(ROOT)}")
        ui_text = ui_text.replace(WIRE_ASSET_MARKER, WIRE_ASSET_MARKER + "\n" + WIRE_ASSET_LINE, 1)
        actions.append(f"wired operating asset toggle buttons in {ui_js.relative_to(ROOT)}")
    else:
        actions.append(f"operating asset toggle buttons already wired in {ui_js.relative_to(ROOT)}")

    write(ui_js, ui_text)

    core_text = read(ui_core_js)
    if "function atlasV8AssetLegendItem" not in core_text:
        if LEGEND_FUNCTION_MARKER not in core_text:
            raise SystemExit(f"Legend function marker not found in {ui_core_js.relative_to(ROOT)}")
        core_text = core_text.replace(LEGEND_FUNCTION_MARKER, LEGEND_ASSET_FUNCTION + LEGEND_FUNCTION_MARKER, 1)
        actions.append(f"added operating asset legend item function in {ui_core_js.relative_to(ROOT)}")
    else:
        actions.append(f"operating asset legend item function already present in {ui_core_js.relative_to(ROOT)}")

    if "Operating Solar PV" not in core_text:
        if LEGEND_INSERT_MARKER not in core_text:
            raise SystemExit(f"Legend insert marker not found in {ui_core_js.relative_to(ROOT)}")
        core_text = core_text.replace(LEGEND_INSERT_MARKER, LEGEND_INSERT_REPLACEMENT, 1)
        actions.append(f"added operating asset legend entries in {ui_core_js.relative_to(ROOT)}")
    else:
        actions.append(f"operating asset legend entries already present in {ui_core_js.relative_to(ROOT)}")

    write(ui_core_js, core_text)

    css_text = read(css)
    if CSS_MARKER not in css_text:
        css_text = css_text.rstrip() + CSS_PATCH + "\n"
        write(css, css_text)
        actions.append(f"added operating asset toggle CSS in {css.relative_to(ROOT)}")
    else:
        actions.append(f"operating asset toggle CSS already present in {css.relative_to(ROOT)}")

    return actions


def main() -> int:
    actions: list[str] = []
    for folder in TARGETS:
        actions.extend(patch_folder(folder))

    REPORTS.mkdir(parents=True, exist_ok=True)
    timestamp = dt.datetime.now(dt.timezone.utc).isoformat()
    report = "\n".join([
        "# Add V6 V7 GIS SLD Operating Asset Layers",
        "",
        f"UTC created: {timestamp}",
        "",
        "## Purpose",
        "",
        "Add existing operating solar, wind and battery project context layers from Atlas V8 into the GIS SLD app before drawing new array logic.",
        "",
        "## Layers added",
        "",
        "- Solar PV operational projects",
        "- Onshore wind operational projects",
        "- Offshore wind operational projects",
        "- Battery storage operational projects",
        "",
        "## Source logic",
        "",
        "The layers use the existing Atlas V8 REPD master data filters from `/dist/repd_master.json`.",
        "",
        "## Actions",
        "",
        *[f"- {a}" for a in actions],
        "",
        "## Manual acceptance test",
        "",
        "1. Open V6 or V7 GIS SLD.",
        "2. Confirm new asset toggle row appears below voltage toggles.",
        "3. Confirm all new asset toggles default OFF.",
        "4. Toggle each layer ON and OFF.",
        "5. Confirm visible asset points appear and can be clicked for popup context.",
        "6. Confirm drawing a new array still works.",
        "",
    ])
    write(REPORT, report)
    print(f"Operating asset layer patch complete. Report: {REPORT.relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
