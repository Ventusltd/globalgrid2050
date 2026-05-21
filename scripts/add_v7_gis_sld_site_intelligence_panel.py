#!/usr/bin/env python3
"""
Add V7 GIS SLD Site Intelligence Panel.

Purpose:
- Turn a map click into structured site context.
- Show nearest operating solar, BESS, onshore wind, offshore wind, substation and voltage corridors.
- Keep this as screening intelligence only, not formal design or grid capacity confirmation.

Scope:
- V7 GIS SLD only.
"""

from __future__ import annotations

import datetime as dt
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
APP = ROOT / "solar-bess-topology-v7" / "gis-sld-financial-sandbox"
INDEX = APP / "index.html"
UI = APP / "gis-sld-v5-ui.js"
CSS = APP / "gis-sld-v5.css"
REPORTS = ROOT / "gridbot_reports"
REPORT = REPORTS / "add_v7_gis_sld_site_intelligence_panel.md"
TEST_FILE = ROOT / "scripts" / "test_v7_gis_sld_site_intelligence_panel.py"

HTML_MARKER = '    <div class="crosshair">⌖</div>\n<div class="map-tool-overlay" id="map_tool_overlay">'
HTML_PATCH = '''    <div class="crosshair">⌖</div>
    <div id="site_intel_panel" class="site-intel-panel collapsed">
        <div class="site-intel-header">
            <span>Site Intelligence</span>
            <button id="site_intel_close" type="button">×</button>
        </div>
        <div id="site_intel_body" class="site-intel-body">
            Click the map to inspect nearby assets, substations and voltage corridors.
        </div>
    </div>
<div class="map-tool-overlay" id="map_tool_overlay">'''

UI_INSERT_MARKER = '// ============================================================\n// ARRAY VISIBILITY AND TARGET MWp SIZING'
SITE_INTEL_JS = r'''
// ============================================================
// V7 SITE INTELLIGENCE PANEL
// ============================================================
const siteIntelData = {
    ready: false,
    loading: false,
    assets: [],
    substations: [],
    grid: {
        "66 kV": [],
        "132 kV": [],
        "275 kV": [],
        "400 kV": []
    }
};

const siteIntelGridUrls = {
    "66 kV": "/repd_grid_atlasv8/data/grid_66kv.geojson",
    "132 kV": "/repd_grid_atlasv8/data/grid_132kv.geojson",
    "275 kV": "/repd_grid_atlasv8/data/grid_275kv.geojson",
    "400 kV": "/repd_grid_atlasv8/data/grid_400kv.geojson"
};

function siteIntelPick(prop, keys, fallback = "") {
    for (const key of keys) {
        if (prop && prop[key] !== undefined && prop[key] !== null && String(prop[key]).trim() !== "") return prop[key];
    }
    return fallback;
}

function siteIntelEscape(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

function siteIntelValidPoint(feature) {
    return feature && feature.geometry && feature.geometry.type === "Point" && Array.isArray(feature.geometry.coordinates);
}

function siteIntelFeatureCollection(raw) {
    if (!raw) return { type: "FeatureCollection", features: [] };
    if (raw.type === "FeatureCollection" && Array.isArray(raw.features)) return raw;
    if (Array.isArray(raw)) return { type: "FeatureCollection", features: raw };
    return { type: "FeatureCollection", features: [] };
}

function siteIntelFlattenLines(features) {
    const lines = [];
    (features || []).forEach(feature => {
        if (!feature || !feature.geometry) return;
        const prop = feature.properties || {};
        if (feature.geometry.type === "LineString") {
            lines.push({ type: "Feature", geometry: feature.geometry, properties: prop });
        } else if (feature.geometry.type === "MultiLineString") {
            feature.geometry.coordinates.forEach(coords => {
                lines.push({ type: "Feature", geometry: { type: "LineString", coordinates: coords }, properties: prop });
            });
        }
    });
    return lines;
}

function showSiteIntelPanel(html) {
    const panel = $("site_intel_panel");
    const body = $("site_intel_body");
    if (!panel || !body) return;
    body.innerHTML = html;
    panel.classList.remove("collapsed");
}

function hideSiteIntelPanel() {
    const panel = $("site_intel_panel");
    if (panel) panel.classList.add("collapsed");
}

async function loadSiteIntelData() {
    if (siteIntelData.ready || siteIntelData.loading) return;
    siteIntelData.loading = true;

    try {
        const [repdRes, subsRes, ...gridResponses] = await Promise.all([
            fetch("/dist/repd_master.json", { cache: "no-cache" }),
            fetch(SUBSTATIONS_URL, { cache: "no-cache" }),
            fetch(siteIntelGridUrls["66 kV"], { cache: "no-cache" }),
            fetch(siteIntelGridUrls["132 kV"], { cache: "no-cache" }),
            fetch(siteIntelGridUrls["275 kV"], { cache: "no-cache" }),
            fetch(siteIntelGridUrls["400 kV"], { cache: "no-cache" })
        ]);

        const repd = repdRes.ok ? await repdRes.json() : { features: [] };
        const subsRaw = subsRes.ok ? await subsRes.json() : { features: [] };
        const subs = typeof normaliseSubstations === "function" ? normaliseSubstations(subsRaw) : siteIntelFeatureCollection(subsRaw);
        const gridKeys = ["66 kV", "132 kV", "275 kV", "400 kV"];

        siteIntelData.assets = (siteIntelFeatureCollection(repd).features || [])
            .filter(siteIntelValidPoint)
            .filter(feature => {
                const p = feature.properties || {};
                const status = String(siteIntelPick(p, ["status", "Status"], "")).toLowerCase();
                const tech = String(siteIntelPick(p, ["tech"], "")).toLowerCase();
                const rawTech = String(siteIntelPick(p, ["raw_tech", "Technology Type"], ""));
                return status === "operational" && (tech === "solar" || tech === "bess" || rawTech === "Wind Onshore" || rawTech === "Wind Offshore");
            });

        siteIntelData.substations = (subs.features || []).filter(siteIntelValidPoint);

        for (let i = 0; i < gridKeys.length; i++) {
            const key = gridKeys[i];
            const res = gridResponses[i];
            const raw = res && res.ok ? await res.json() : { features: [] };
            siteIntelData.grid[key] = siteIntelFlattenLines(siteIntelFeatureCollection(raw).features);
        }

        siteIntelData.ready = true;
    } catch (err) {
        console.error("Site intelligence data load failed", err);
        showSiteIntelPanel(`<div class="site-intel-warning">Site intelligence data unavailable: ${siteIntelEscape(err.message || err)}</div>`);
    } finally {
        siteIntelData.loading = false;
    }
}

function siteIntelAssetGroup(feature) {
    const p = feature.properties || {};
    const tech = String(siteIntelPick(p, ["tech"], "")).toLowerCase();
    const rawTech = String(siteIntelPick(p, ["raw_tech", "Technology Type"], ""));
    if (tech === "solar") return "Operating Solar PV";
    if (tech === "bess") return "Operating Battery Storage";
    if (rawTech === "Wind Onshore") return "Operating Onshore Wind";
    if (rawTech === "Wind Offshore") return "Operating Offshore Wind";
    return "Operating Asset";
}

function nearestPointFeature(point, features, predicate) {
    let best = null;
    (features || []).forEach(feature => {
        if (!siteIntelValidPoint(feature)) return;
        if (predicate && !predicate(feature)) return;
        const d = turf.distance(point, turf.point(feature.geometry.coordinates), { units: "kilometers" });
        if (!best || d < best.distanceKm) best = { feature, distanceKm: d };
    });
    return best;
}

function nearestLineFeature(point, features) {
    let best = null;
    (features || []).forEach(feature => {
        if (!feature || !feature.geometry || feature.geometry.type !== "LineString") return;
        try {
            const snapped = turf.nearestPointOnLine(feature, point, { units: "kilometers" });
            const d = Number(snapped.properties && snapped.properties.dist);
            if (Number.isFinite(d) && (!best || d < best.distanceKm)) best = { feature, distanceKm: d };
        } catch (err) {
            // Ignore malformed line fragments.
        }
    });
    return best;
}

function formatKm(value) {
    if (!Number.isFinite(value)) return "n/a";
    if (value < 1) return `${Math.round(value * 1000)} m`;
    return `${value.toFixed(1)} km`;
}

function formatCapacity(feature) {
    const p = feature?.properties || {};
    const capacity = Number(siteIntelPick(p, ["capacity", "capacity_mw", "Capacity (MW)"], NaN));
    return Number.isFinite(capacity) && capacity > 0 ? `${capacity.toFixed(capacity >= 100 ? 0 : 1)} MW` : "n/a";
}

function assetName(feature) {
    const p = feature?.properties || {};
    return siteIntelPick(p, ["name", "project", "site", "Site Name", "Project Name"], "Operating asset");
}

function substationName(feature) {
    const p = feature?.properties || {};
    return siteIntelPick(p, ["name_clean", "name", "Name", "site_name", "Site Name", "substation", "Substation"], "Substation");
}

function substationVoltage(feature) {
    const p = feature?.properties || {};
    return siteIntelPick(p, ["voltage_clean", "voltage", "Voltage", "kv", "kV", "Voltage kV"], "Unknown");
}

function siteIntelRow(label, main, meta, danger = false) {
    return `<div class="site-intel-row${danger ? " warn" : ""}">
        <div class="site-intel-label">${siteIntelEscape(label)}</div>
        <div class="site-intel-main">${siteIntelEscape(main)}</div>
        <div class="site-intel-meta">${siteIntelEscape(meta)}</div>
    </div>`;
}

function siteIntelOpportunityNotes(results) {
    const notes = [];
    const hvDistances = [results.grid["132 kV"], results.grid["275 kV"], results.grid["400 kV"]]
        .filter(Boolean)
        .map(item => item.distanceKm);
    const minHv = hvDistances.length ? Math.min(...hvDistances) : NaN;
    const nearestSolar = results.assets.solar?.distanceKm;
    const nearestBess = results.assets.bess?.distanceKm;

    if (Number.isFinite(minHv) && minHv <= 5) notes.push("Near high voltage corridor. Worth deeper grid screening.");
    if (Number.isFinite(minHv) && minHv > 15) notes.push("High voltage corridor not immediately nearby. Route and connection assumptions need care.");
    if (Number.isFinite(nearestSolar) && nearestSolar <= 10) notes.push("Existing operating solar nearby. Compare pattern, grid route and project scale.");
    if (Number.isFinite(nearestBess) && nearestBess <= 15) notes.push("Operating battery storage nearby. Check co location or grid constraint context.");
    if (!notes.length) notes.push("Use as early spatial screening only. Formal grid and design studies still required.");
    return notes;
}

async function inspectSiteIntelligenceAt(lngLat) {
    if (!lngLat || typeof turf === "undefined") return;
    showSiteIntelPanel(`<div class="site-intel-loading">Loading site intelligence…</div>`);
    await loadSiteIntelData();
    if (!siteIntelData.ready) return;

    const point = turf.point([lngLat.lng, lngLat.lat]);
    const results = {
        assets: {
            solar: nearestPointFeature(point, siteIntelData.assets, f => siteIntelAssetGroup(f) === "Operating Solar PV"),
            bess: nearestPointFeature(point, siteIntelData.assets, f => siteIntelAssetGroup(f) === "Operating Battery Storage"),
            onshore: nearestPointFeature(point, siteIntelData.assets, f => siteIntelAssetGroup(f) === "Operating Onshore Wind"),
            offshore: nearestPointFeature(point, siteIntelData.assets, f => siteIntelAssetGroup(f) === "Operating Offshore Wind")
        },
        substation: nearestPointFeature(point, siteIntelData.substations),
        grid: {}
    };

    Object.keys(siteIntelData.grid).forEach(key => {
        results.grid[key] = nearestLineFeature(point, siteIntelData.grid[key]);
    });

    const rows = [];
    rows.push(siteIntelRow("Clicked location", `${lngLat.lat.toFixed(5)}, ${lngLat.lng.toFixed(5)}`, "Reference point only"));

    const addAssetRow = (label, item) => {
        if (!item) rows.push(siteIntelRow(label, "No data", "Layer data unavailable", true));
        else rows.push(siteIntelRow(label, assetName(item.feature), `${formatKm(item.distanceKm)} · ${formatCapacity(item.feature)}`));
    };

    addAssetRow("Nearest solar", results.assets.solar);
    addAssetRow("Nearest BESS", results.assets.bess);
    addAssetRow("Nearest onshore wind", results.assets.onshore);
    addAssetRow("Nearest offshore wind", results.assets.offshore);

    if (results.substation) {
        rows.push(siteIntelRow("Nearest substation", substationName(results.substation.feature), `${formatKm(results.substation.distanceKm)} · ${substationVoltage(results.substation.feature)}`));
    } else {
        rows.push(siteIntelRow("Nearest substation", "No data", "Substation data unavailable", true));
    }

    ["66 kV", "132 kV", "275 kV", "400 kV"].forEach(key => {
        const item = results.grid[key];
        rows.push(siteIntelRow(`Nearest ${key}`, item ? formatKm(item.distanceKm) : "No data", "Atlas V8 corridor reference", !item));
    });

    const notes = siteIntelOpportunityNotes(results).map(note => `<li>${siteIntelEscape(note)}</li>`).join("");

    showSiteIntelPanel(`
        <div class="site-intel-section-title">Nearest infrastructure context</div>
        ${rows.join("")}
        <div class="site-intel-section-title">Screening notes</div>
        <ul class="site-intel-notes">${notes}</ul>
        <div class="site-intel-disclaimer">Indicative spatial screening only. Distances do not confirm capacity, rights, routes, consent or connection feasibility.</div>
    `);
}

function wireSiteIntelligencePanel() {
    $("site_intel_close")?.addEventListener("click", hideSiteIntelPanel);
    if (!map) return;
    map.on("click", e => {
        const target = e.originalEvent && e.originalEvent.target;
        if (target && target.closest && target.closest(".map-controls, .map-tool-overlay, .legend, .gis-map-search, .site-intel-panel")) return;
        inspectSiteIntelligenceAt(e.lngLat);
    });
}

'''

WIRE_MARKER = 'wireGisMapSearch();'
WIRE_REPLACEMENT = 'wireGisMapSearch();\nwireSiteIntelligencePanel();'

CSS_MARKER = '/* GLOBALGRID2050 V7 SITE INTELLIGENCE PANEL */'
CSS_PATCH = r'''

/* GLOBALGRID2050 V7 SITE INTELLIGENCE PANEL */
.site-intel-panel {
    position: absolute;
    right: 12px;
    bottom: 16px;
    z-index: 42;
    width: min(380px, calc(100% - 24px));
    max-height: 58%;
    overflow-y: auto;
    background: rgba(5, 5, 5, 0.94);
    border: 1px solid #2f343d;
    border-radius: 8px;
    color: #ffffff;
    font-family: "Courier New", monospace;
    box-shadow: 0 10px 30px rgba(0,0,0,0.45);
}
.site-intel-panel.collapsed {
    display: none;
}
.site-intel-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    padding: 10px 12px;
    border-bottom: 1px solid #2f343d;
    color: #00ffff;
    font-weight: bold;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    font-size: 12px;
}
.site-intel-header button {
    background: transparent;
    border: 0;
    color: #a6adbb;
    font-size: 20px;
    line-height: 1;
    cursor: pointer;
}
.site-intel-body {
    padding: 10px 12px 12px 12px;
    font-size: 11px;
}
.site-intel-section-title {
    color: #00ff88;
    font-weight: bold;
    text-transform: uppercase;
    margin: 8px 0 6px 0;
}
.site-intel-row {
    display: grid;
    grid-template-columns: 105px 1fr;
    gap: 4px 8px;
    padding: 7px 0;
    border-bottom: 1px solid rgba(255,255,255,0.08);
}
.site-intel-row.warn .site-intel-main,
.site-intel-row.warn .site-intel-meta {
    color: #ff9900;
}
.site-intel-label {
    color: #a6adbb;
}
.site-intel-main {
    color: #ffffff;
    font-weight: bold;
    word-break: break-word;
}
.site-intel-meta {
    grid-column: 2;
    color: #00ffff;
}
.site-intel-notes {
    margin: 6px 0 8px 18px;
    padding: 0;
    color: #ffffff;
}
.site-intel-notes li {
    margin-bottom: 5px;
}
.site-intel-disclaimer,
.site-intel-loading,
.site-intel-warning {
    margin-top: 8px;
    padding: 8px;
    border: 1px solid #333;
    background: rgba(255,255,255,0.04);
    color: #a6adbb;
    line-height: 1.35;
}
.site-intel-warning {
    color: #ff9900;
    border-color: #ff9900;
}

@media (max-width: 900px) {
    .site-intel-panel {
        left: 10px;
        right: 10px;
        bottom: 14px;
        width: auto;
        max-height: 45%;
    }
    .site-intel-row {
        grid-template-columns: 96px 1fr;
    }
}

@media print {
    .site-intel-panel {
        display: none !important;
    }
}
'''

TEST_CONTENT = r'''#!/usr/bin/env python3
"""Static checks for V7 GIS SLD Site Intelligence Panel."""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
APP = ROOT / "solar-bess-topology-v7" / "gis-sld-financial-sandbox"

index = (APP / "index.html").read_text(encoding="utf-8")
ui = (APP / "gis-sld-v5-ui.js").read_text(encoding="utf-8")
css = (APP / "gis-sld-v5.css").read_text(encoding="utf-8")

for token in ["site_intel_panel", "site_intel_body", "site_intel_close"]:
    assert token in index, token
for token in ["inspectSiteIntelligenceAt", "nearestLineFeature", "nearestPointFeature", "wireSiteIntelligencePanel"]:
    assert token in ui, token
for token in ["66 kV", "132 kV", "275 kV", "400 kV", "/dist/repd_master.json", "SUBSTATIONS_URL"]:
    assert token in ui, token
for token in ["site-intel-panel", "site-intel-row", "SITE INTELLIGENCE PANEL"]:
    assert token in css, token

print("V7 GIS SLD site intelligence panel static checks passed.")
'''


def read(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def write(path: Path, text: str) -> None:
    path.write_text(text, encoding="utf-8")


def main() -> int:
    actions: list[str] = []

    index = read(INDEX)
    if 'id="site_intel_panel"' not in index:
        if HTML_MARKER not in index:
            raise SystemExit("Site intelligence HTML marker not found")
        index = index.replace(HTML_MARKER, HTML_PATCH, 1)
        actions.append("added site intelligence panel HTML")
    else:
        actions.append("site intelligence panel HTML already present")
    write(INDEX, index)

    ui = read(UI)
    if "function inspectSiteIntelligenceAt" not in ui:
        if UI_INSERT_MARKER not in ui:
            raise SystemExit("Site intelligence UI marker not found")
        ui = ui.replace(UI_INSERT_MARKER, SITE_INTEL_JS + UI_INSERT_MARKER, 1)
        actions.append("added site intelligence JavaScript")
    else:
        actions.append("site intelligence JavaScript already present")

    if "wireSiteIntelligencePanel();" not in ui:
        if WIRE_MARKER in ui:
            ui = ui.replace(WIRE_MARKER, WIRE_REPLACEMENT, 1)
        else:
            # Fall back to array sizing wire point if search workflow has not been applied yet.
            fallback = "wireArraySizingControls();"
            if fallback not in ui:
                raise SystemExit("No suitable wire marker found for site intelligence")
            ui = ui.replace(fallback, fallback + "\nwireSiteIntelligencePanel();", 1)
        actions.append("wired site intelligence panel")
    else:
        actions.append("site intelligence panel already wired")
    write(UI, ui)

    css = read(CSS)
    if CSS_MARKER not in css:
        css = css.rstrip() + CSS_PATCH + "\n"
        actions.append("added site intelligence CSS")
    else:
        actions.append("site intelligence CSS already present")
    write(CSS, css)

    write(TEST_FILE, TEST_CONTENT)
    actions.append("added static test script")

    REPORTS.mkdir(parents=True, exist_ok=True)
    REPORT.write_text("\n".join([
        "# Add V7 GIS SLD Site Intelligence Panel",
        "",
        f"UTC created: {dt.datetime.now(dt.timezone.utc).isoformat()}",
        "",
        "## Purpose",
        "",
        "Add a click driven site intelligence panel that turns map geometry into structured early stage screening context.",
        "",
        "## Behaviour",
        "",
        "- Click the map to inspect the location.",
        "- Shows nearest operating solar, BESS, onshore wind and offshore wind assets.",
        "- Shows nearest public substation reference point.",
        "- Shows nearest 66 kV, 132 kV, 275 kV and 400 kV Atlas V8 grid corridors.",
        "- Provides simple screening notes based on nearby asset and grid context.",
        "- Clearly states that results are indicative screening only.",
        "",
        "## Actions",
        "",
        *[f"- {a}" for a in actions],
        "",
        "## Test",
        "",
        "Run `python scripts/test_v7_gis_sld_site_intelligence_panel.py`.",
        "",
        "## Manual acceptance test",
        "",
        "1. Open V7 GIS SLD.",
        "2. Click the map away from buttons.",
        "3. Confirm Site Intelligence panel opens.",
        "4. Confirm nearest assets, substation and voltage corridors show distances.",
        "5. Close the panel with ×.",
        "6. Confirm existing map tools, toggles and drawing still work.",
        "",
    ]), encoding="utf-8")

    print("V7 GIS SLD site intelligence panel patch complete.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
