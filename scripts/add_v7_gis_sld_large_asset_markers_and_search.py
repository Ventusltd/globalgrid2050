#!/usr/bin/env python3
"""
Add V7 GIS SLD large operating asset marker visibility and map search.

Scope:
- V7 GIS SLD only.
- Increase operating solar and BESS markers at and above 30 MW so larger sites are easier to find.
- Add a compact map search bar for operating assets and substations.
- Search works independently of whether the layer is currently visible.
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
REPORT = REPORTS / "add_v7_gis_sld_large_asset_markers_and_search.md"

SEARCH_HTML_MARKER = '<div class="panel panel-right">\n    <div id="fetch_status"></div>'
SEARCH_HTML_REPLACEMENT = '''<div class="panel panel-right">
    <div id="fetch_status"></div>
    <div class="gis-map-search" id="gis_map_search">
        <input id="gis_search_input" class="gis-search-input" type="text" placeholder="Search site or substation..." autocomplete="off" />
        <button id="gis_search_btn" class="map-toggle-btn gis-search-btn">GO</button>
        <div id="gis_search_results" class="gis-search-results"></div>
    </div>'''

SOLAR_RADIUS_OLD = '"circle-radius": ["interpolate", ["linear"], ["coalesce", ["get", "capacity"], 0], 0, 5, 10, 7, 50, 10, 100, 13, 200, 16, 350, 20, 500, 24]'
SOLAR_RADIUS_NEW = '"circle-radius": ["interpolate", ["linear"], ["coalesce", ["get", "capacity"], 0], 0, 6, 10, 10, 29.99, 14, 30, 28, 50, 32, 100, 38, 200, 44, 350, 52, 500, 60]'
BESS_RADIUS_NEW = '"circle-radius": ["interpolate", ["linear"], ["coalesce", ["get", "capacity"], 0], 0, 6, 10, 10, 29.99, 14, 30, 24, 50, 28, 100, 34, 200, 40, 350, 48, 500, 56]'

UI_MARKER = '// ============================================================\n// ARRAY VISIBILITY AND TARGET MWp SIZING'
SEARCH_JS = r'''
// ============================================================
// GIS MAP SEARCH: OPERATING ASSETS AND SUBSTATIONS
// ============================================================
let gisSearchReady = false;
let gisAssetSearchIndex = [];
let gisSubstationSearchIndex = [];

function gisSearchEscape(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

function gisSearchPick(prop, keys, fallback = "") {
    for (const key of keys) {
        if (prop && prop[key] !== undefined && prop[key] !== null && String(prop[key]).trim() !== "") return prop[key];
    }
    return fallback;
}

function gisSearchValidPoint(feature) {
    return feature && feature.geometry && feature.geometry.type === "Point" && Array.isArray(feature.geometry.coordinates);
}

async function buildGisSearchIndexes() {
    if (gisSearchReady) return;
    try {
        const [repdRes, subsRes] = await Promise.all([
            fetch("/dist/repd_master.json", { cache: "no-cache" }),
            fetch(SUBSTATIONS_URL, { cache: "no-cache" })
        ]);

        const repd = repdRes.ok ? await repdRes.json() : { features: [] };
        const subsRaw = subsRes.ok ? await subsRes.json() : { features: [] };
        const subs = normaliseSubstations?.(subsRaw) || { features: [] };

        gisAssetSearchIndex = (repd.features || [])
            .filter(gisSearchValidPoint)
            .filter(f => {
                const p = f.properties || {};
                return String(p.status || "").toLowerCase() === "operational" &&
                    (["solar", "bess"].includes(String(p.tech || "")) || ["Wind Onshore", "Wind Offshore"].includes(String(p.raw_tech || "")));
            })
            .map(f => {
                const p = f.properties || {};
                const name = gisSearchPick(p, ["name", "project", "site", "Site Name"], "Operating asset");
                const tech = gisSearchPick(p, ["raw_tech", "tech"], "Unknown");
                const capacity = Number(gisSearchPick(p, ["capacity", "capacity_mw"], 0)) || 0;
                return {
                    kind: "asset",
                    feature: f,
                    name,
                    tech,
                    capacity,
                    label: `${name} ${tech} ${capacity} MW`.toLowerCase()
                };
            });

        gisSubstationSearchIndex = (subs.features || [])
            .filter(gisSearchValidPoint)
            .map(f => {
                const p = f.properties || {};
                const name = gisSearchPick(p, ["name_clean", "name", "Name", "substation", "Substation"], "Substation");
                const voltage = gisSearchPick(p, ["voltage_clean", "voltage", "Voltage", "kv", "kV"], "Unknown");
                return {
                    kind: "substation",
                    feature: f,
                    name,
                    voltage,
                    capacity: 0,
                    label: `${name} ${voltage} substation`.toLowerCase()
                };
            });

        gisSearchReady = true;
    } catch (err) {
        console.error("GIS search index failed", err);
        setFetchStatus?.("Search index unavailable", true);
    }
}

function gisSearchResultsEl() {
    return $("gis_search_results");
}

function hideGisSearchResults() {
    const el = gisSearchResultsEl();
    if (el) el.style.display = "none";
}

function showGisSearchResults(html) {
    const el = gisSearchResultsEl();
    if (!el) return;
    el.innerHTML = html;
    el.style.display = "block";
}

function renderGisSearchResults(query) {
    const q = String(query || "").trim().toLowerCase();
    if (q.length < 2) {
        hideGisSearchResults();
        return;
    }

    const assetMatches = gisAssetSearchIndex
        .filter(item => item.label.includes(q))
        .sort((a, b) => b.capacity - a.capacity)
        .slice(0, 8);
    const subMatches = gisSubstationSearchIndex
        .filter(item => item.label.includes(q))
        .slice(0, 8);
    const matches = [...assetMatches, ...subMatches].slice(0, 12);

    if (!matches.length) {
        showGisSearchResults('<div class="gis-search-result-empty">No sites or substations found</div>');
        return;
    }

    showGisSearchResults(matches.map((item, idx) => {
        const meta = item.kind === "asset" ? `${gisSearchEscape(item.tech)} · ${item.capacity || "n/a"} MW` : `Substation · ${gisSearchEscape(item.voltage)}`;
        const cls = item.kind === "asset" ? "asset" : "substation";
        return `<button class="gis-search-result ${cls}" data-gis-search-idx="${idx}">
            <strong>${gisSearchEscape(item.name)}</strong>
            <span>${meta}</span>
        </button>`;
    }).join(""));

    const el = gisSearchResultsEl();
    if (!el) return;
    el.querySelectorAll("[data-gis-search-idx]").forEach((btn, idx) => {
        btn.addEventListener("click", () => flyToGisSearchItem(matches[idx]));
    });
}

function flyToGisSearchItem(item) {
    if (!map || !item || !gisSearchValidPoint(item.feature)) return;
    const coords = item.feature.geometry.coordinates.slice();
    map.flyTo({ center: coords, zoom: item.kind === "asset" ? 11.5 : 13.5, duration: 1200, essential: true });
    hideGisSearchResults();
    const input = $("gis_search_input");
    if (input) input.value = item.name;

    setTimeout(() => {
        if (item.kind === "asset") {
            const p = item.feature.properties || {};
            const name = gisSearchPick(p, ["name", "project", "site", "Site Name"], "Operating asset");
            const tech = gisSearchPick(p, ["raw_tech", "tech"], "Unknown technology");
            const status = gisSearchPick(p, ["status"], "Unknown status");
            const capacity = gisSearchPick(p, ["capacity", "capacity_mw"], "n/a");
            showPopup(coords, `
                <div style="margin-bottom:5px;color:#00ff88;font-weight:bold;font-size:13px;text-transform:uppercase;">Operating Asset</div>
                <div class="popup-row"><span>Name:</span><span class="popup-val" style="color:#fff;">${gisSearchEscape(name)}</span></div>
                <div class="popup-row"><span>Technology:</span><span class="popup-val" style="color:#fff;">${gisSearchEscape(tech)}</span></div>
                <div class="popup-row"><span>Status:</span><span class="popup-val" style="color:#fff;">${gisSearchEscape(status)}</span></div>
                <div class="popup-row"><span>Capacity:</span><span class="popup-val" style="color:#fff;">${gisSearchEscape(capacity)} MW</span></div>
            `);
        } else {
            const p = item.feature.properties || {};
            const name = gisSearchPick(p, ["name_clean", "name", "Name", "substation", "Substation"], "Substation");
            const voltage = gisSearchPick(p, ["voltage_clean", "voltage", "Voltage", "kv", "kV"], "Unknown");
            showPopup(coords, `
                <div style="margin-bottom:5px;color:#ff3333;font-weight:bold;font-size:13px;text-transform:uppercase;">Substation</div>
                <div class="popup-row"><span>Name:</span><span class="popup-val" style="color:#fff;">${gisSearchEscape(name)}</span></div>
                <div class="popup-row"><span>Voltage:</span><span class="popup-val" style="color:#fff;">${gisSearchEscape(voltage)}</span></div>
                <div class="popup-row"><span>Lon:</span><span class="popup-val" style="color:#fff;">${Number(coords[0]).toFixed(6)}</span></div>
                <div class="popup-row"><span>Lat:</span><span class="popup-val" style="color:#fff;">${Number(coords[1]).toFixed(6)}</span></div>
            `);
        }
    }, 1250);
}

async function wireGisMapSearch() {
    const input = $("gis_search_input");
    const btn = $("gis_search_btn");
    if (!input || !btn) return;

    input.addEventListener("focus", buildGisSearchIndexes);
    input.addEventListener("input", async () => {
        await buildGisSearchIndexes();
        renderGisSearchResults(input.value);
    });
    input.addEventListener("keydown", async e => {
        if (e.key === "Enter") {
            await buildGisSearchIndexes();
            const first = gisSearchResultsEl()?.querySelector(".gis-search-result");
            if (first) first.click();
            else renderGisSearchResults(input.value);
        }
        if (e.key === "Escape") hideGisSearchResults();
    });
    btn.addEventListener("click", async () => {
        await buildGisSearchIndexes();
        const first = gisSearchResultsEl()?.querySelector(".gis-search-result");
        if (first) first.click();
        else renderGisSearchResults(input.value);
    });
    document.addEventListener("click", e => {
        const wrap = $("gis_map_search");
        if (wrap && !wrap.contains(e.target)) hideGisSearchResults();
    });
}

'''

WIRE_MARKER = 'wireArraySizingControls();'
WIRE_REPLACEMENT = 'wireArraySizingControls();\nwireGisMapSearch();'

CSS_MARKER = '/* GLOBALGRID2050 V7 LARGE ASSET MARKERS AND GIS SEARCH */'
CSS_PATCH = r'''

/* GLOBALGRID2050 V7 LARGE ASSET MARKERS AND GIS SEARCH */
.gis-map-search {
    position: absolute;
    top: 10px;
    left: 10px;
    z-index: 45;
    display: flex;
    gap: 6px;
    align-items: flex-start;
    width: min(420px, calc(100% - 20px));
    pointer-events: auto;
}
.gis-search-input {
    flex: 1;
    min-width: 0;
    height: 32px;
    background: rgba(0, 0, 0, 0.88);
    color: #00ffff;
    border: 1px solid #444;
    border-radius: 3px;
    padding: 6px 9px;
    font-family: "Courier New", monospace;
    font-size: 11px;
    font-weight: bold;
}
.gis-search-input:focus {
    outline: none;
    border-color: #00ffff;
}
.gis-search-btn {
    height: 32px;
    padding: 6px 10px;
}
.gis-search-results {
    display: none;
    position: absolute;
    top: 38px;
    left: 0;
    right: 44px;
    background: rgba(5, 5, 5, 0.96);
    border: 1px solid #2f343d;
    border-radius: 4px;
    max-height: 260px;
    overflow-y: auto;
    z-index: 46;
}
.gis-search-result,
.gis-search-result-empty {
    display: block;
    width: 100%;
    padding: 8px 10px;
    background: transparent;
    border: 0;
    border-bottom: 1px solid #222;
    color: #ffffff;
    font-family: "Courier New", monospace;
    font-size: 10px;
    text-align: left;
    cursor: pointer;
}
.gis-search-result:hover {
    background: rgba(0, 255, 255, 0.08);
}
.gis-search-result strong {
    display: block;
    color: #ffffff;
    margin-bottom: 3px;
}
.gis-search-result span {
    display: block;
    color: #a6adbb;
}
.gis-search-result.asset span {
    color: #00ff88;
}
.gis-search-result.substation span {
    color: #ff9999;
}
.gis-search-result-empty {
    color: #a6adbb;
    cursor: default;
}

@media (max-width: 900px) {
    .gis-map-search {
        top: 54px;
        left: 10px;
        right: 10px;
        width: auto;
    }
    .map-controls {
        padding-top: 0 !important;
    }
}

@media (max-width: 520px) {
    .gis-map-search {
        top: 58px;
        width: auto;
    }
    .gis-search-input {
        height: 34px;
        font-size: 10px;
    }
    .gis-search-btn {
        height: 34px;
    }
}

@media print {
    .gis-map-search {
        display: none !important;
    }
}
'''

TEST_FILE = ROOT / "scripts" / "test_v7_gis_sld_large_asset_markers_and_search.py"
TEST_CONTENT = r'''#!/usr/bin/env python3
"""Static checks for V7 GIS SLD large asset markers and search."""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
APP = ROOT / "solar-bess-topology-v7" / "gis-sld-financial-sandbox"

index = (APP / "index.html").read_text(encoding="utf-8")
map_js = (APP / "gis-sld-v5-map.js").read_text(encoding="utf-8")
ui_js = (APP / "gis-sld-v5-ui.js").read_text(encoding="utf-8")
css = (APP / "gis-sld-v5.css").read_text(encoding="utf-8")

for token in ["gis_map_search", "gis_search_input", "gis_search_results"]:
    assert token in index, token
for token in ["30, 28", "500, 60", "atlas-v8-asset-solar-operational"]:
    assert token in map_js, token
for token in ["buildGisSearchIndexes", "wireGisMapSearch", "flyToGisSearchItem", "normaliseSubstations"]:
    assert token in ui_js, token
for token in ["gis-map-search", "gis-search-result", "LARGE ASSET MARKERS"]:
    assert token in css, token

print("V7 GIS SLD large asset markers and search static checks passed.")
'''


def read(path: Path) -> str:
    return path.read_text(encoding='utf-8')


def write(path: Path, text: str) -> None:
    path.write_text(text, encoding='utf-8')


def main() -> int:
    actions: list[str] = []

    index = read(INDEX)
    if 'id="gis_map_search"' not in index:
        if SEARCH_HTML_MARKER not in index:
            raise SystemExit('Search HTML marker not found')
        index = index.replace(SEARCH_HTML_MARKER, SEARCH_HTML_REPLACEMENT, 1)
        actions.append('added GIS map search UI')
    else:
        actions.append('GIS map search UI already present')
    write(INDEX, index)

    map_js = read(MAP_JS)
    if '30, 28, 50, 32, 100, 38' not in map_js:
        if map_js.count(SOLAR_RADIUS_OLD) < 4:
            raise SystemExit('Expected operating asset radius expressions not found')
        # Replace in order: solar, onshore wind, offshore wind, bess. Keep wind proportional but still larger.
        map_js = map_js.replace(SOLAR_RADIUS_OLD, SOLAR_RADIUS_NEW, 1)
        map_js = map_js.replace(SOLAR_RADIUS_OLD, '"circle-radius": ["interpolate", ["linear"], ["coalesce", ["get", "capacity"], 0], 0, 5, 10, 8, 29.99, 12, 30, 20, 50, 24, 100, 30, 200, 36, 350, 44, 500, 52]', 1)
        map_js = map_js.replace(SOLAR_RADIUS_OLD, '"circle-radius": ["interpolate", ["linear"], ["coalesce", ["get", "capacity"], 0], 0, 5, 10, 8, 29.99, 12, 30, 20, 50, 24, 100, 30, 200, 36, 350, 44, 500, 52]', 1)
        map_js = map_js.replace(SOLAR_RADIUS_OLD, BESS_RADIUS_NEW, 1)
        actions.append('increased operating solar, wind and BESS marker sizes above 30 MW')
    else:
        actions.append('large operating asset marker sizes already updated')
    write(MAP_JS, map_js)

    ui = read(UI_JS)
    if 'function buildGisSearchIndexes' not in ui:
        if UI_MARKER not in ui:
            raise SystemExit('UI search insertion marker not found')
        ui = ui.replace(UI_MARKER, SEARCH_JS + UI_MARKER, 1)
        actions.append('added GIS site and substation search functions')
    else:
        actions.append('GIS site and substation search functions already present')

    if 'wireGisMapSearch();' not in ui:
        if WIRE_MARKER not in ui:
            raise SystemExit('wireGisMapSearch marker not found')
        ui = ui.replace(WIRE_MARKER, WIRE_REPLACEMENT, 1)
        actions.append('wired GIS map search on boot')
    else:
        actions.append('GIS map search already wired')
    write(UI_JS, ui)

    css = read(CSS)
    if CSS_MARKER not in css:
        css = css.rstrip() + CSS_PATCH + '\n'
        actions.append('added GIS search CSS')
    else:
        actions.append('GIS search CSS already present')
    write(CSS, css)

    write(TEST_FILE, TEST_CONTENT)
    actions.append('added static test script')

    REPORTS.mkdir(parents=True, exist_ok=True)
    REPORT.write_text('\n'.join([
        '# Add V7 GIS SLD Large Asset Markers And Search',
        '',
        f'UTC created: {dt.datetime.now(dt.timezone.utc).isoformat()}',
        '',
        '## Purpose',
        '',
        'Make larger operating solar, wind and BESS sites easier to identify and add a map search box for operating sites and substations.',
        '',
        '## Changes',
        '',
        '- Operating solar sites above 30 MW are enlarged significantly.',
        '- Operating BESS sites above 30 MW are enlarged significantly.',
        '- Operating onshore and offshore wind sites above 30 MW are also made easier to see.',
        '- Adds a GIS map search bar for operating assets and substations.',
        '- Search can fly to a selected site or substation and open a popup.',
        '',
        '## Actions',
        '',
        *[f'- {a}' for a in actions],
        '',
        '## Manual acceptance test',
        '',
        '1. Open V7 GIS SLD.',
        '2. Turn on operating solar and confirm sites above 30 MW are much larger.',
        '3. Search for a known operating solar site and confirm the map flies to it.',
        '4. Search for a substation and confirm the map flies to it.',
        '5. Confirm layer toggles still work.',
        '',
    ]), encoding='utf-8')

    print('V7 large asset marker and search patch complete.')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
