#!/usr/bin/env python3
"""
Add V6 and V7 GIS SLD print map pack.

Purpose:
- Make overhead line and public substation layers default OFF for a cleaner working map.
- Replace the print button with a print preparation routine.
- Add 3 print map pages after the normal report:
  1. Full page current map figure.
  2. Full page zoomed out context map figure.
  3. Full page satellite map figure.
- Keep the normal report above the map figures.

The print figures use MapLibre canvas snapshots.
"""

from __future__ import annotations

import datetime as dt
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
REPORTS = ROOT / "gridbot_reports"
REPORT = REPORTS / "add_v6_v7_gis_sld_print_map_pack.md"

TARGETS = [
    ROOT / "solar-bess-topology-v6" / "gis-sld-financial-sandbox",
    ROOT / "solar-bess-topology-v7" / "gis-sld-financial-sandbox",
]

PRINT_PACK_JS_MARKER = "// GLOBALGRID2050 GIS SLD PRINT MAP PACK"
PRINT_PACK_CSS_MARKER = "/* GLOBALGRID2050 GIS SLD PRINT MAP PACK */"

PRINT_EVENT_OLD = '$("btn_print_report")?.addEventListener("click", () => window.print());'
PRINT_EVENT_NEW = '$("btn_print_report")?.addEventListener("click", prepareGisSldPrintReport);'

JS_PATCH = r'''

// GLOBALGRID2050 GIS SLD PRINT MAP PACK
function sleepForPrintPack(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function setLayerVisibilityForPrintPack(layerId, visible) {
    if (!map || !map.getLayer(layerId)) return;
    map.setLayoutProperty(layerId, "visibility", visible ? "visible" : "none");
}

function setAtlasLayersDefaultOff() {
    if (typeof atlasV8GridLayerVisibility === "undefined") return;
    Object.keys(atlasV8GridLayerVisibility).forEach(voltageKey => {
        atlasV8GridLayerVisibility[voltageKey] = false;
        const layerId = atlasV8GridLayerIds?.[voltageKey];
        if (layerId) setLayerVisibilityForPrintPack(layerId, false);
    });
    updateAtlasV8GridToggleButtons?.();
    updateLegend?.();
}

function setSubsDefaultOff() {
    if (typeof state === "undefined") return;
    state.subsVisible = false;
    setLayerVisibilityForPrintPack("l-subs", false);
    updateSubsToggleButton?.();
    updateLegend?.();
}

function enforceCleanDefaultMapLayers() {
    setAtlasLayersDefaultOff();
    setSubsDefaultOff();
}

function getMapPrintState() {
    if (!map) return null;
    return {
        center: map.getCenter(),
        zoom: map.getZoom(),
        bearing: map.getBearing(),
        pitch: map.getPitch(),
        satActive: !!state.satActive,
        subsVisible: !!state.subsVisible,
        atlas: typeof atlasV8GridLayerVisibility !== "undefined" ? { ...atlasV8GridLayerVisibility } : {},
        keyCollapsed: $("map_legend")?.classList.contains("key-collapsed") || false,
        toolsCollapsed: $("map_tool_overlay")?.classList.contains("tools-collapsed") || false,
        mapExpanded: document.body.classList.contains("map-expanded")
    };
}

async function restoreMapPrintState(saved) {
    if (!map || !saved) return;

    if (typeof state !== "undefined") {
        state.satActive = saved.satActive;
        state.subsVisible = saved.subsVisible;
    }

    setLayerVisibilityForPrintPack("l-sat", saved.satActive);
    setLayerVisibilityForPrintPack("l-subs", saved.subsVisible);

    if (typeof atlasV8GridLayerVisibility !== "undefined") {
        Object.keys(saved.atlas || {}).forEach(voltageKey => {
            atlasV8GridLayerVisibility[voltageKey] = saved.atlas[voltageKey];
            const layerId = atlasV8GridLayerIds?.[voltageKey];
            if (layerId) setLayerVisibilityForPrintPack(layerId, saved.atlas[voltageKey]);
        });
    }

    const legend = $("map_legend");
    if (legend) legend.classList.toggle("key-collapsed", saved.keyCollapsed);
    const keyBtn = $("btn_key_toggle");
    if (keyBtn) {
        keyBtn.textContent = saved.keyCollapsed ? "KEY OFF" : "KEY ON";
        keyBtn.classList.toggle("active", !saved.keyCollapsed);
    }

    const overlay = $("map_tool_overlay");
    if (overlay) overlay.classList.toggle("tools-collapsed", saved.toolsCollapsed);
    const toolsBtn = $("btn_map_tools_toggle");
    if (toolsBtn) {
        toolsBtn.textContent = saved.toolsCollapsed ? "TOOLS OFF" : "TOOLS ON";
        toolsBtn.classList.toggle("active", !saved.toolsCollapsed);
    }

    document.body.classList.toggle("map-expanded", saved.mapExpanded);
    document.querySelector(".panel-right")?.classList.toggle("map-expanded", saved.mapExpanded);

    map.jumpTo({ center: saved.center, zoom: saved.zoom, bearing: saved.bearing, pitch: saved.pitch });
    updateSubsToggleButton?.();
    updateAtlasV8GridToggleButtons?.();
    updateLegend?.();
    map.resize();
    await sleepForPrintPack(350);
}

function ensurePrintMapPackContainer() {
    let pack = document.getElementById("print_map_pack");
    if (!pack) {
        pack = document.createElement("section");
        pack.id = "print_map_pack";
        pack.className = "print-map-pack";
        document.body.appendChild(pack);
    }
    pack.innerHTML = "";
    return pack;
}

function addPrintMapFigure(pack, title, dataUrl, note, landscape = false) {
    const page = document.createElement("section");
    page.className = landscape ? "print-map-page print-map-page-landscape" : "print-map-page";

    const heading = document.createElement("h2");
    heading.textContent = title;

    const img = document.createElement("img");
    img.src = dataUrl;
    img.alt = title;

    const caption = document.createElement("p");
    caption.textContent = note || "Map figure generated from current GIS SLD sandbox view. Indicative only.";

    page.appendChild(heading);
    page.appendChild(img);
    page.appendChild(caption);
    pack.appendChild(page);
}

async function captureCurrentMapForPrint() {
    if (!map) return "";
    map.resize();
    await sleepForPrintPack(650);
    return map.getCanvas().toDataURL("image/png");
}

function getTopologyBoundsForPrintPack() {
    if (typeof turf === "undefined" || !state?.currentGeoJSON?.features?.length) return null;
    try {
        const bbox = turf.bbox(state.currentGeoJSON);
        if (!bbox || bbox.length !== 4 || bbox.some(v => !Number.isFinite(v))) return null;
        return [[bbox[0], bbox[1]], [bbox[2], bbox[3]]];
    } catch (err) {
        console.warn("Print pack bbox failed", err);
        return null;
    }
}

async function fitContextMapForPrint() {
    const bounds = getTopologyBoundsForPrintPack();
    if (bounds) {
        map.fitBounds(bounds, { padding: 90, duration: 0, maxZoom: 12 });
    } else {
        const currentZoom = map.getZoom();
        map.setZoom(Math.max(currentZoom - 4, 7));
    }
    await sleepForPrintPack(750);
}

async function setSatelliteForPrintPack(active) {
    if (!map) return;
    if (typeof state !== "undefined") state.satActive = !!active;
    setLayerVisibilityForPrintPack("l-sat", !!active);
    const btn = $("btn_basemap");
    if (btn) {
        btn.textContent = active ? "DARK MATTER VIEW" : "SATELLITE VIEW";
        btn.classList.toggle("active", !!active);
    }
    await sleepForPrintPack(500);
}

async function prepareGisSldPrintReport() {
    if (!map) {
        window.print();
        return;
    }

    const btn = $("btn_print_report");
    const oldText = btn ? btn.textContent : "";
    if (btn) btn.textContent = "PREPARING";

    const saved = getMapPrintState();
    const pack = ensurePrintMapPackContainer();

    try {
        document.body.classList.add("preparing-print-pack");
        document.body.classList.remove("map-expanded");
        document.querySelector(".panel-right")?.classList.remove("map-expanded");
        $("map_tool_overlay")?.classList.add("tools-collapsed");
        $("map_legend")?.classList.add("key-collapsed");

        // Page 1 map: current working view, but clean with user selected layers retained.
        map.resize();
        await sleepForPrintPack(600);
        const currentMap = await captureCurrentMapForPrint();
        addPrintMapFigure(pack, "Map Figure 1: Current Project View", currentMap, "Current GIS SLD project view. Interactive controls are removed from print output.");

        // Page 2 map: zoomed out context. Keep current basemap and layer settings.
        await fitContextMapForPrint();
        const contextMap = await captureCurrentMapForPrint();
        addPrintMapFigure(pack, "Map Figure 2: Wider Grid And Route Context", contextMap, "Zoomed out context view showing wider relationship between project, route assumptions and grid geography.");

        // Page 3 map: satellite view, clean and full page.
        await setSatelliteForPrintPack(true);
        await fitContextMapForPrint();
        const satelliteMap = await captureCurrentMapForPrint();
        addPrintMapFigure(pack, "Map Figure 3: Satellite Context View", satelliteMap, "Satellite context view for visual land, route and surrounding area review. Indicative only.", true);

        await restoreMapPrintState(saved);
        document.body.classList.remove("preparing-print-pack");
        if (btn) btn.textContent = oldText || "PRINT";
        window.print();
    } catch (err) {
        console.error("GIS SLD print pack failed", err);
        await restoreMapPrintState(saved);
        document.body.classList.remove("preparing-print-pack");
        if (btn) btn.textContent = oldText || "PRINT";
        window.print();
    }
}

// Clean map defaults after the map and controls have loaded.
setTimeout(enforceCleanDefaultMapLayers, 1200);
'''

CSS_PATCH = r'''

/* GLOBALGRID2050 GIS SLD PRINT MAP PACK */
@media print {
  .panel-right {
    page-break-before: auto !important;
    break-before: auto !important;
  }

  #map {
    height: 150mm !important;
    min-height: 150mm !important;
    max-height: 150mm !important;
    width: 100% !important;
    overflow: hidden !important;
  }

  .print-map-pack {
    display: block !important;
    width: 100% !important;
    margin: 0 !important;
    padding: 0 !important;
    background: #ffffff !important;
    color: #111111 !important;
  }

  .print-map-page {
    display: block !important;
    width: 100% !important;
    min-height: 265mm !important;
    page-break-before: always !important;
    break-before: page !important;
    page-break-after: always !important;
    break-after: page !important;
    page-break-inside: avoid !important;
    break-inside: avoid !important;
    margin: 0 !important;
    padding: 0 !important;
    background: #ffffff !important;
    color: #111111 !important;
  }

  .print-map-page h2 {
    display: block !important;
    font-size: 12pt !important;
    color: #111111 !important;
    margin: 0 0 4mm 0 !important;
    padding: 0 0 2mm 0 !important;
    border-bottom: 1px solid #999999 !important;
  }

  .print-map-page img {
    display: block !important;
    width: 100% !important;
    height: 225mm !important;
    object-fit: contain !important;
    border: 1px solid #999999 !important;
    background: #ffffff !important;
    margin: 0 0 3mm 0 !important;
  }

  .print-map-page p {
    display: block !important;
    color: #111111 !important;
    font-size: 8pt !important;
    line-height: 1.2 !important;
    margin: 0 !important;
  }

  .print-map-page-landscape {
    min-height: 265mm !important;
  }

  .print-map-page-landscape img {
    height: 225mm !important;
  }
}

@media screen {
  .print-map-pack {
    display: none;
  }
}
'''


def read(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def write(path: Path, text: str) -> None:
    path.write_text(text, encoding="utf-8")


def patch_folder(folder: Path) -> list[str]:
    actions: list[str] = []
    map_js = folder / "gis-sld-v5-map.js"
    ui_js = folder / "gis-sld-v5-ui.js"
    css = folder / "gis-sld-v5.css"

    for path in [map_js, ui_js, css]:
        if not path.exists():
            raise SystemExit(f"Missing file: {path.relative_to(ROOT)}")

    map_text = read(map_js)
    if '"66kv": true' in map_text or '"132kv": true' in map_text or '"275kv": true' in map_text or '"400kv": true' in map_text:
        map_text = map_text.replace('"66kv": true', '"66kv": false')
        map_text = map_text.replace('"132kv": true', '"132kv": false')
        map_text = map_text.replace('"275kv": true', '"275kv": false')
        map_text = map_text.replace('"400kv": true', '"400kv": false')
        write(map_js, map_text)
        actions.append(f"set Atlas overhead line layers default OFF in {map_js.relative_to(ROOT)}")
    else:
        actions.append(f"Atlas overhead line defaults already OFF in {map_js.relative_to(ROOT)}")

    ui_text = read(ui_js)
    if PRINT_EVENT_OLD in ui_text:
        ui_text = ui_text.replace(PRINT_EVENT_OLD, PRINT_EVENT_NEW, 1)
        actions.append(f"replaced direct window.print with print preparation routine in {ui_js.relative_to(ROOT)}")
    elif PRINT_EVENT_NEW in ui_text:
        actions.append(f"print preparation routine already wired in {ui_js.relative_to(ROOT)}")
    else:
        raise SystemExit(f"Print event marker not found in {ui_js.relative_to(ROOT)}")

    if PRINT_PACK_JS_MARKER not in ui_text:
        ui_text = ui_text.rstrip() + JS_PATCH + "\n"
        actions.append(f"added GIS SLD print map pack JS in {ui_js.relative_to(ROOT)}")
    else:
        actions.append(f"GIS SLD print map pack JS already present in {ui_js.relative_to(ROOT)}")
    write(ui_js, ui_text)

    css_text = read(css)
    if PRINT_PACK_CSS_MARKER not in css_text:
        css_text = css_text.rstrip() + CSS_PATCH + "\n"
        write(css, css_text)
        actions.append(f"added GIS SLD print map pack CSS in {css.relative_to(ROOT)}")
    else:
        actions.append(f"GIS SLD print map pack CSS already present in {css.relative_to(ROOT)}")

    return actions


def main() -> int:
    actions: list[str] = []
    for folder in TARGETS:
        actions.extend(patch_folder(folder))

    REPORTS.mkdir(parents=True, exist_ok=True)
    timestamp = dt.datetime.now(dt.timezone.utc).isoformat()
    report = "\n".join([
        "# Add V6 V7 GIS SLD Print Map Pack",
        "",
        f"UTC created: {timestamp}",
        "",
        "## Purpose",
        "",
        "Add a proper GIS SLD map print pack: clean default layers, print preparation routine and 3 additional map figure pages after the normal report.",
        "",
        "## Changes",
        "",
        "- Atlas overhead line layers default to OFF.",
        "- Public substations are forced OFF after load for a cleaner default map.",
        "- Print button prepares the map before printing instead of calling window.print directly.",
        "- Adds Map Figure 1: current project view.",
        "- Adds Map Figure 2: wider grid and route context.",
        "- Adds Map Figure 3: satellite context view.",
        "- Restores the user's previous map state after snapshots are taken.",
        "",
        "## Actions",
        "",
        *[f"- {a}" for a in actions],
        "",
        "## Manual acceptance test",
        "",
        "1. Open V6 or V7 GIS SLD.",
        "2. Confirm overhead lines and public substations start OFF.",
        "3. Turn layers ON and OFF manually to confirm toggles still work.",
        "4. Press PRINT.",
        "5. Confirm normal report prints first.",
        "6. Confirm 3 full page map figures print near the bottom.",
        "7. Confirm final map figure is satellite context.",
        "",
    ])
    write(REPORT, report)
    print(f"GIS SLD print map pack complete. Report: {REPORT.relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
