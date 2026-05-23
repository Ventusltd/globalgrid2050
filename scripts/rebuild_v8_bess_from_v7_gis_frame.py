#!/usr/bin/env python3
"""Rebuild V8 BESS GIS SLD app from the working V7 GIS SLD frame.

This is a controlled reset of the V8 BESS main app:
- Copy the working V7 GIS SLD Financial Sandbox file set.
- Keep MapLibre, CARTO, satellite, map controls and existing GIS drawing frame.
- Add a visible BESS parameter panel.
- Hide the PV specific parameter tabs from the first BESS view rather than deleting
  them, so the underlying V7 map logic is not broken.
- Add a BESS geospatial drawing layer that draws battery containers, PCS blocks,
  transformer zone, compound boundary, access road and export point on the map.

V7 is not modified.
"""

from __future__ import annotations

import datetime as dt
import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "solar-bess-topology-v7" / "gis-sld-financial-sandbox"
V8 = ROOT / "solar-bess-topology-v8"
DEST = V8 / "bess-gis-sld-financial-sandbox"
REPORT = ROOT / "gridbot_reports" / "rebuild_v8_bess_from_v7_gis_frame.md"

REQUIRED = [
    "index.html",
    "gis-sld-v5.css",
    "gis-sld-v5-config.js",
    "gis-sld-v5-helpers.js",
    "gis-sld-v5-state.js",
    "gis-sld-v5-substations.js",
    "gis-sld-v5-map.js",
    "gis-sld-v5-calculations.js",
    "gis-sld-v5-finance.js",
    "gis-sld-v5-ui-core.js",
    "gis-sld-v5-drawing.js",
    "gis-sld-v5-export.js",
    "gis-sld-v5-ui.js",
]

BESS_PANEL = r'''

    <section id="v8_bess_panel" class="v8-bess-panel">
        <h3>BESS GIS SLD Financial Sandbox V8</h3>
        <div class="ux-note">BESS only study frame. Containers provide energy in MWh. PCS provides power in MW. Grid export caps the maximum export. Cable sizing, R, X, Z, leakage, reverse current and protection coordination remain in the advanced topology review.</div>

        <h3>BESS Power and Energy</h3>
        <div class="input-group"><label>Grid Export Limit MW</label><input type="number" id="bess_export_mw" value="50" step="1" min="0" /></div>
        <div class="input-group"><label>Storage Duration Hours</label><input type="number" id="bess_duration_h" value="3" step="0.25" min="0" /></div>
        <div class="input-group"><label>Required Energy MWh</label><input type="number" id="bess_energy_mwh" value="150" step="1" min="0" /></div>
        <button id="btn_bess_sync_energy" type="button" class="btn-main">Set MWh from MW x hours</button>

        <h3>BESS Containers</h3>
        <div class="input-group"><label>Container Size</label><select id="bess_container_size"><option value="20ft">20 ft</option><option value="40ft" selected>40 ft</option></select></div>
        <div class="input-group"><label>Energy per Container MWh</label><input type="number" id="bess_container_mwh" value="5" step="0.1" min="0.1" /></div>
        <div class="input-group"><label>Container Length m</label><input type="number" id="bess_container_l" value="12.2" step="0.1" min="1" /></div>
        <div class="input-group"><label>Container Width m</label><input type="number" id="bess_container_w" value="2.44" step="0.01" min="1" /></div>
        <div class="input-group"><label>Container Spacing m</label><input type="number" id="bess_container_gap" value="2.5" step="0.1" min="0" /></div>
        <div class="input-group"><label>Containers per Row</label><input type="number" id="bess_containers_per_row" value="10" step="1" min="1" /></div>
        <div class="input-group"><label>Row Spacing m</label><input type="number" id="bess_row_gap" value="6" step="0.5" min="0" /></div>

        <h3>PCS and Layout Mode</h3>
        <div class="input-group"><label>Layout Mode</label><select id="bess_layout_mode"><option value="integrated">Integrated PCS Transformer Station</option><option value="separated">External Transformer with Separate PCS</option><option value="distributed">Distributed PCS Islands</option><option value="corridor">PCS Corridor Layout</option><option value="central">Central PCS Block</option><option value="hv_compound">Transmission Scale HV Compound</option></select></div>
        <div class="input-group"><label>PCS Rating MW</label><input type="number" id="bess_pcs_mw" value="50" step="0.1" min="0.1" /></div>
        <div class="input-group"><label>Containers per PCS</label><input type="number" id="bess_containers_per_pcs" value="30" step="1" min="1" /></div>
        <div class="input-group"><label>Access Road Width m</label><input type="number" id="bess_access_road_m" value="6" step="0.5" min="0" /></div>
        <div class="input-group"><label>Rotation Degrees</label><input type="number" id="bess_rotation_deg" value="0" step="5" /></div>

        <h3>BESS Summary</h3>
        <div class="stat-row"><span>Required Containers</span><span class="stat-val" id="bess_out_containers">30</span></div>
        <div class="stat-row"><span>PCS Count</span><span class="stat-val" id="bess_out_pcs">1</span></div>
        <div class="stat-row"><span>Total PCS Power</span><span class="stat-val" id="bess_out_pcs_power">50 MW</span></div>
        <div class="stat-row"><span>Approximate BESS Field</span><span class="stat-val" id="bess_out_field">0 m x 0 m</span></div>
        <div class="stat-row"><span>Export Cap</span><span class="stat-val" id="bess_out_export">50 MW</span></div>
        <div class="stat-row"><span>Energy Duration</span><span class="stat-val" id="bess_out_duration">3 h</span></div>

        <div class="v8-bess-actions">
            <button id="btn_bess_draw_geo" type="button" class="btn-main">Draw BESS on Map</button>
            <button id="btn_bess_reset_geo" type="button" class="btn-main">Reset BESS Drawing</button>
            <button id="btn_bess_export_geojson" type="button" class="btn-main">Export BESS GeoJSON</button>
        </div>
    </section>
'''

CSS_APPEND = r'''

/* V8 BESS reset from working V7 GIS frame */
.v8-bess-panel {
    border: 2px solid var(--accent);
    border-radius: 10px;
    padding: 14px;
    margin: 14px 0;
    background: rgba(0, 30, 30, 0.32);
}

.v8-bess-panel h3 {
    color: var(--accent);
}

.v8-bess-actions {
    display: grid;
    grid-template-columns: 1fr;
    gap: 8px;
    margin-top: 12px;
}

.v8-hidden-pv {
    display: none !important;
}

.v8-dev-label {
    color: #ff3333;
    font-weight: bold;
}
'''

JS_APPEND = r'''

// --- V8 BESS geospatial drawing layer built on working V7 GIS frame ---
window.v8BessGeoJson = { type: 'FeatureCollection', features: [] };

function v8n(id, fallback = 0) {
    const el = document.getElementById(id);
    const value = parseFloat(el ? el.value : fallback);
    return Number.isFinite(value) ? value : fallback;
}

function v8s(id, fallback = '') {
    const el = document.getElementById(id);
    return el ? el.value : fallback;
}

function v8Set(id, text) {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
}

function v8Fmt(value, digits = 2) {
    return Number.isFinite(value) ? value.toLocaleString(undefined, { maximumFractionDigits: digits }) : '0';
}

function v8BessCalc() {
    const exportMw = v8n('bess_export_mw', 50);
    const duration = v8n('bess_duration_h', 3);
    const energy = v8n('bess_energy_mwh', exportMw * duration);
    const containerMwh = Math.max(0.1, v8n('bess_container_mwh', 5));
    const pcsMw = Math.max(0.1, v8n('bess_pcs_mw', 50));
    const containersPerPcs = Math.max(1, Math.round(v8n('bess_containers_per_pcs', 30)));
    const containers = Math.max(1, Math.ceil(energy / containerMwh));
    const pcsByPower = Math.max(1, Math.ceil(exportMw / pcsMw));
    const pcsByContainers = Math.max(1, Math.ceil(containers / containersPerPcs));
    const pcsCount = Math.max(pcsByPower, pcsByContainers);
    const totalPcsMw = pcsCount * pcsMw;
    const containersPerRow = Math.max(1, Math.round(v8n('bess_containers_per_row', 10)));
    const rows = Math.max(1, Math.ceil(containers / containersPerRow));
    const lengthM = Math.max(1, v8n('bess_container_l', 12.2));
    const widthM = Math.max(1, v8n('bess_container_w', 2.44));
    const gapM = Math.max(0, v8n('bess_container_gap', 2.5));
    const rowGapM = Math.max(0, v8n('bess_row_gap', 6));
    const fieldLength = containersPerRow * lengthM + Math.max(0, containersPerRow - 1) * gapM;
    const fieldWidth = rows * widthM + Math.max(0, rows - 1) * rowGapM;
    return { exportMw, duration, energy, containerMwh, pcsMw, containersPerPcs, containers, pcsCount, totalPcsMw, containersPerRow, rows, lengthM, widthM, gapM, rowGapM, fieldLength, fieldWidth, layoutMode: v8s('bess_layout_mode', 'integrated'), accessRoadM: v8n('bess_access_road_m', 6), rotation: v8n('bess_rotation_deg', 0) };
}

function v8UpdateBessSummary() {
    const c = v8BessCalc();
    v8Set('bess_out_containers', String(c.containers));
    v8Set('bess_out_pcs', String(c.pcsCount));
    v8Set('bess_out_pcs_power', v8Fmt(c.totalPcsMw, 1) + ' MW');
    v8Set('bess_out_field', v8Fmt(c.fieldLength, 1) + ' m x ' + v8Fmt(c.fieldWidth, 1) + ' m');
    v8Set('bess_out_export', v8Fmt(c.exportMw, 1) + ' MW');
    v8Set('bess_out_duration', c.exportMw > 0 ? v8Fmt(c.energy / c.exportMw, 2) + ' h' : '0 h');
}

function v8MetresToLngLat(origin, eastM, northM) {
    const lat = origin.lat;
    const lng = origin.lng;
    return [lng + eastM / (111320 * Math.cos(lat * Math.PI / 180)), lat + northM / 111320];
}

function v8Rotate(x, y, deg) {
    const rad = deg * Math.PI / 180;
    return [x * Math.cos(rad) - y * Math.sin(rad), x * Math.sin(rad) + y * Math.cos(rad)];
}

function v8RectFeature(origin, cx, cy, w, h, rotation, props) {
    const coords = [[-w/2,-h/2],[w/2,-h/2],[w/2,h/2],[-w/2,h/2],[-w/2,-h/2]].map(([x,y]) => {
        const [rx, ry] = v8Rotate(cx + x, cy + y, rotation);
        return v8MetresToLngLat(origin, rx, ry);
    });
    return { type:'Feature', properties:props, geometry:{ type:'Polygon', coordinates:[coords] } };
}

function v8PointFeature(origin, x, y, rotation, props) {
    const [rx, ry] = v8Rotate(x, y, rotation);
    return { type:'Feature', properties:props, geometry:{ type:'Point', coordinates:v8MetresToLngLat(origin, rx, ry) } };
}

function v8LineFeature(origin, points, rotation, props) {
    return { type:'Feature', properties:props, geometry:{ type:'LineString', coordinates:points.map(([x,y]) => { const [rx, ry] = v8Rotate(x, y, rotation); return v8MetresToLngLat(origin, rx, ry); }) } };
}

function v8BuildBessGeoJson(origin) {
    const c = v8BessCalc();
    const features = [];
    const cols = Math.max(1, Math.min(c.containersPerRow, 30));
    const rows = Math.max(1, Math.ceil(c.containers / cols));
    const pitchX = c.lengthM + c.gapM;
    const pitchY = c.widthM + c.rowGapM;
    const fieldW = cols * c.lengthM + Math.max(0, cols - 1) * c.gapM;
    const fieldH = rows * c.widthM + Math.max(0, rows - 1) * c.rowGapM;
    const startX = -fieldW / 2 + c.lengthM / 2;
    const startY = fieldH / 2 - c.widthM / 2;
    const pad = Math.max(25, c.accessRoadM * 3);
    const electricalX = fieldW / 2 + 55;
    const roadY = -fieldH / 2 - Math.max(18, c.accessRoadM);

    features.push(v8RectFeature(origin, 0, 0, fieldW + pad * 2 + 220, fieldH + pad * 2 + 120, c.rotation, { role:'compound_boundary', label:'BESS compound boundary', layout_mode:c.layoutMode }));
    features.push(v8RectFeature(origin, 0, roadY, fieldW + pad * 2 + 160, Math.max(6, c.accessRoadM), c.rotation, { role:'access_road', label:'Access road and maintenance corridor' }));

    for (let i = 0; i < c.containers; i++) {
        const col = i % cols;
        const row = Math.floor(i / cols);
        features.push(v8RectFeature(origin, startX + col * pitchX, startY - row * pitchY, c.lengthM, c.widthM, c.rotation, { role:'bess_container', label:'BESS container ' + (i + 1), container_mwh:c.containerMwh }));
    }

    const pcsShown = Math.min(c.pcsCount, 40);
    for (let i = 0; i < pcsShown; i++) {
        let x = electricalX;
        let y = fieldH / 2 - i * 16;
        if (c.layoutMode === 'distributed') { x = startX + (i % cols) * pitchX; y = fieldH / 2 + 26 + Math.floor(i / Math.max(1, cols)) * 16; }
        if (c.layoutMode === 'corridor') { x = 0; y = roadY - 25 - i * 15; }
        if (c.layoutMode === 'central') { x = electricalX; y = 0; }
        features.push(v8RectFeature(origin, x, y, c.layoutMode === 'integrated' ? 22 : 14, 10, c.rotation, { role:c.layoutMode === 'integrated' ? 'integrated_pcs_transformer' : 'pcs_block', label:c.layoutMode === 'integrated' ? 'Integrated PCS transformer ' + (i + 1) : 'PCS block ' + (i + 1), pcs_mw:c.pcsMw }));
    }

    if (c.layoutMode !== 'integrated') features.push(v8RectFeature(origin, electricalX + 42, 0, 28, 18, c.rotation, { role:'external_transformer', label:'External transformer zone' }));
    if (c.layoutMode === 'hv_compound') features.push(v8RectFeature(origin, electricalX + 88, -36, 58, 38, c.rotation, { role:'hv_compound_placeholder', label:'Future HV compound placeholder' }));
    features.push(v8PointFeature(origin, electricalX + 120, roadY - 50, c.rotation, { role:'grid_export_point', label:'Grid export point', export_mw:c.exportMw }));
    features.push(v8LineFeature(origin, [[fieldW / 2, 0], [electricalX - 10, 0]], c.rotation, { role:'dc_collection_path', label:'Indicative DC collection path, not cable sizing' }));
    return { type:'FeatureCollection', features };
}

function v8EnsureBessGeoLayers() {
    if (!window.map) return;
    if (!map.getSource('v8-bess-layout')) map.addSource('v8-bess-layout', { type:'geojson', data:window.v8BessGeoJson });
    const layers = [
        ['v8-bess-boundary', ['==',['get','role'],'compound_boundary'], 'rgba(43,124,255,0.08)', 'rgba(43,124,255,0.75)'],
        ['v8-bess-containers', ['==',['get','role'],'bess_container'], 'rgba(0,255,136,0.38)', 'rgba(0,255,136,0.95)'],
        ['v8-bess-pcs', ['any',['==',['get','role'],'pcs_block'],['==',['get','role'],'integrated_pcs_transformer']], 'rgba(0,255,255,0.38)', 'rgba(0,255,255,0.95)'],
        ['v8-bess-transformer', ['any',['==',['get','role'],'external_transformer'],['==',['get','role'],'hv_compound_placeholder']], 'rgba(255,153,0,0.38)', 'rgba(255,153,0,0.95)'],
        ['v8-bess-road', ['==',['get','role'],'access_road'], 'rgba(120,80,40,0.55)', 'rgba(120,80,40,0.95)']
    ];
    layers.forEach(([id, filter, fill, outline]) => { if (!map.getLayer(id)) map.addLayer({ id, type:'fill', source:'v8-bess-layout', filter, paint:{ 'fill-color':fill, 'fill-outline-color':outline } }); });
    if (!map.getLayer('v8-bess-path')) map.addLayer({ id:'v8-bess-path', type:'line', source:'v8-bess-layout', filter:['==',['get','role'],'dc_collection_path'], paint:{ 'line-color':'#ff9900', 'line-width':3, 'line-dasharray':[2,2] } });
    if (!map.getLayer('v8-bess-export')) map.addLayer({ id:'v8-bess-export', type:'circle', source:'v8-bess-layout', filter:['==',['get','role'],'grid_export_point'], paint:{ 'circle-radius':7, 'circle-color':'#ffffff', 'circle-stroke-color':'#00ffff', 'circle-stroke-width':2 } });
}

function v8RefreshBessGeo() {
    if (!window.map) return;
    v8EnsureBessGeoLayers();
    const source = map.getSource('v8-bess-layout');
    if (source) source.setData(window.v8BessGeoJson);
}

function v8DrawBessAtMapCentre() {
    if (!window.map) return;
    window.v8BessGeoJson = v8BuildBessGeoJson(map.getCenter());
    v8RefreshBessGeo();
}

function v8ResetBessGeo() {
    window.v8BessGeoJson = { type:'FeatureCollection', features:[] };
    v8RefreshBessGeo();
}

function v8ExportBessGeoJson() {
    const blob = new Blob([JSON.stringify(window.v8BessGeoJson, null, 2)], { type:'application/geo+json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'v8-bess-layout.geojson';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
}

function v8InitBessUi() {
    document.getElementById('btn_bess_sync_energy')?.addEventListener('click', () => { document.getElementById('bess_energy_mwh').value = v8Fmt(v8n('bess_export_mw', 50) * v8n('bess_duration_h', 3), 2); v8UpdateBessSummary(); });
    document.getElementById('btn_bess_draw_geo')?.addEventListener('click', v8DrawBessAtMapCentre);
    document.getElementById('btn_bess_reset_geo')?.addEventListener('click', v8ResetBessGeo);
    document.getElementById('btn_bess_export_geojson')?.addEventListener('click', v8ExportBessGeoJson);
    document.querySelectorAll('#v8_bess_panel input, #v8_bess_panel select').forEach(el => { el.addEventListener('input', v8UpdateBessSummary); el.addEventListener('change', v8UpdateBessSummary); });
    setTimeout(() => { if (window.map) { map.on('style.load', v8RefreshBessGeo); map.on('load', v8RefreshBessGeo); } }, 1000);
    v8UpdateBessSummary();
}

document.addEventListener('DOMContentLoaded', v8InitBessUi);
'''

V8_INDEX = r'''<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>GlobalGrid2050 V8</title>
<style>
:root { --bg:#050505; --panel:#0b0e14; --line:#2f343d; --text:#fff; --muted:#a6adbb; --accent:#00ffff; --ok:#00ff88; --danger:#ff3333; }
* { box-sizing:border-box; }
body { margin:0; padding:28px; background:var(--bg); color:var(--text); font-family:"Courier New", monospace; }
header, main { max-width:1180px; margin:0 auto 24px auto; }
header { border:1px solid var(--line); background:rgba(10,10,10,.96); padding:22px; border-radius:14px; }
.kicker { color:var(--accent); text-transform:uppercase; letter-spacing:.14em; font-size:12px; }
h1 { margin:8px 0 10px 0; font-size:28px; }
p { color:var(--muted); line-height:1.55; }
.grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(280px,1fr)); gap:18px; }
.card { display:block; border:1px solid var(--line); background:var(--panel); border-radius:14px; padding:20px; text-decoration:none; color:var(--text); min-height:180px; }
.card:hover { border-color:var(--accent); }
.card h2 { color:var(--accent); margin:0 0 10px 0; }
.card span { color:var(--ok); font-weight:bold; }
.warning { margin-top:14px; padding:14px; border:1px solid var(--danger); border-radius:10px; color:var(--danger); background:rgba(255,51,51,.08); font-weight:bold; }
</style>
</head>
<body>
<header>
<div class="kicker">GlobalGrid2050 V8</div>
<h1>BESS Standalone Study Workspace</h1>
<p>V8 is a standalone BESS study workspace based on the working V7 GIS SLD frame. V7 remains stable. V9 may later merge proven solar and BESS logic into one UI.</p>
<div class="warning">STATUS: TESTING AND DEVELOPMENT. Screening only. Formal cable, protection, thermal and grid studies remain required.</div>
</header>
<main class="grid">
<a class="card" href="./bess-gis-sld-financial-sandbox/index.html">
<h2>BESS GIS SLD Financial Sandbox</h2>
<p>Main BESS only map, SLD, layout mode, footprint and financial screening frame.</p>
<span>Open app</span>
</a>
<a class="card" href="./bess-electrical-topology-review/index.html">
<h2>BESS Electrical Topology Review</h2>
<p>Detailed BESS engineering review for DC leakage, reverse current protection, PCS interface, cable R, X, Z and protection coordination screening.</p>
<span>Open app</span>
</a>
</main>
</body>
</html>
'''


def ensure_sources() -> None:
    missing = [name for name in REQUIRED if not (SRC / name).exists()]
    if missing:
        raise SystemExit("Missing V7 source files: " + ", ".join(missing))


def copy_v7_frame() -> None:
    DEST.mkdir(parents=True, exist_ok=True)
    for name in REQUIRED:
        shutil.copy2(SRC / name, DEST / name)


def patch_index() -> None:
    path = DEST / "index.html"
    text = path.read_text(encoding="utf-8")
    text = text.replace("<title>GIS SLD Financial Sandbox V7</title>", "<title>BESS GIS SLD Financial Sandbox V8</title>")
    text = text.replace("Solar Photovoltaic (PV) Development, Engineering, Procurement and Construction (EPC) and Grid Analysis", "BESS GIS SLD Financial Sandbox V8 <span class=\"v8-dev-label\">(in development)</span>")
    marker = "    <div class=\"tab-container\">"
    if BESS_PANEL not in text:
        if marker not in text:
            raise SystemExit("Could not find V7 tab container marker")
        text = text.replace(marker, BESS_PANEL + "\n" + marker, 1)
    text = text.replace("<div class=\"tab-container\">", "<div class=\"tab-container v8-hidden-pv\">", 1)
    text = text.replace("<div id=\"string_tab\" class=\"tab-content active\">", "<div id=\"string_tab\" class=\"tab-content active v8-hidden-pv\">", 1)
    text = text.replace("<div id=\"central_tab\" class=\"tab-content\">", "<div id=\"central_tab\" class=\"tab-content v8-hidden-pv\">", 1)
    path.write_text(text, encoding="utf-8")


def patch_css() -> None:
    path = DEST / "gis-sld-v5.css"
    text = path.read_text(encoding="utf-8")
    if "V8 BESS reset from working V7 GIS frame" not in text:
        text = text.rstrip() + "\n" + CSS_APPEND + "\n"
    path.write_text(text, encoding="utf-8")


def patch_js() -> None:
    path = DEST / "gis-sld-v5-ui.js"
    text = path.read_text(encoding="utf-8")
    if "V8 BESS geospatial drawing layer built on working V7 GIS frame" not in text:
        text = text.rstrip() + "\n" + JS_APPEND + "\n"
    path.write_text(text, encoding="utf-8")


def write_docs() -> None:
    (DEST / "README.md").write_text("""# BESS GIS SLD Financial Sandbox V8

This app is rebuilt from the working V7 GIS SLD Financial Sandbox frame.

## What is kept from V7

- MapLibre map frame.
- CARTO / satellite map logic.
- Location search.
- Grid and substation GIS frame.
- Existing V7 map controls and UI structure.

## What V8 adds

- BESS MW and MWh inputs.
- 20 ft and 40 ft container assumptions.
- Energy per container.
- PCS rating and containers per PCS.
- BESS layout modes.
- Geospatial BESS drawing on the map.
- BESS GeoJSON export.

## Boundary

Cable sizing, cable impedance, leakage, reverse current and protection coordination remain in the advanced BESS Electrical Topology Review.
""", encoding="utf-8")
    V8.mkdir(parents=True, exist_ok=True)
    (V8 / "index.html").write_text(V8_INDEX, encoding="utf-8")
    REPORT.parent.mkdir(parents=True, exist_ok=True)
    REPORT.write_text("\n".join([
        "# Rebuild V8 BESS From V7 GIS Frame",
        "",
        f"UTC created: {dt.datetime.now(dt.timezone.utc).isoformat()}",
        "",
        "## Source",
        "",
        "```text",
        "solar-bess-topology-v7/gis-sld-financial-sandbox/",
        "```",
        "",
        "## Destination",
        "",
        "```text",
        "solar-bess-topology-v8/bess-gis-sld-financial-sandbox/",
        "```",
        "",
        "## Method",
        "",
        "Copied the working V7 GIS SLD frame and added BESS specific inputs and geospatial drawing, while hiding the PV parameter tabs rather than deleting them.",
        "",
        "## Boundary",
        "",
        "No cable sizing or protection coordination added to the layout app.",
        "",
        "## V7 protection",
        "",
        "No V7 files are modified.",
        "",
    ]), encoding="utf-8")


def main() -> int:
    ensure_sources()
    copy_v7_frame()
    patch_index()
    patch_css()
    patch_js()
    write_docs()
    print("Rebuilt V8 BESS app from working V7 GIS frame.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
