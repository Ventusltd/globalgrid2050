#!/usr/bin/env python3
"""Build the V8 BESS GIS SLD Financial Sandbox.

Purpose:
- Leave V7 stable.
- Create a BESS only main frame app for V8.
- Keep the GIS, SLD and finance concept.
- Remove PV specific logic from the BESS layout app.
- Keep cable sizing and protection coordination out of the layout app.

The detailed cable, impedance, leakage, reverse current and protection logic belongs in:
solar-bess-topology-v8/bess-electrical-topology-review/
"""

from __future__ import annotations

import datetime as dt
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
V8 = ROOT / "solar-bess-topology-v8"
APP = V8 / "bess-gis-sld-financial-sandbox"
LEGACY = V8 / "bess-pcs-standalone"
REPORT = ROOT / "gridbot_reports" / "build_v8_bess_gis_sld_financial_sandbox.md"

INDEX_HTML = r'''<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>BESS GIS SLD Financial Sandbox V8 | GlobalGrid2050</title>
<script src="https://unpkg.com/maplibre-gl@3.3.1/dist/maplibre-gl.js"></script>
<link href="https://unpkg.com/maplibre-gl@3.3.1/dist/maplibre-gl.css" rel="stylesheet" />
<link rel="stylesheet" href="./bess-gis-sld-financial-sandbox.css" />
</head>
<body>
<div class="app-shell">
  <header class="topbar">
    <div>
      <div class="kicker">GlobalGrid2050 V8</div>
      <h1>BESS GIS SLD Financial Sandbox</h1>
      <p>BESS only main frame app for map based siting, layout mode, single line logic, footprint screening and financial assumptions. Cable sizing and protection validation are deliberately left to the advanced electrical topology review.</p>
    </div>
    <div class="topbar-actions">
      <button id="btn_print" type="button">Print</button>
      <a href="../bess-electrical-topology-review/index.html">Advanced topology review</a>
      <a href="../index.html">Back to V8</a>
    </div>
  </header>

  <main class="workspace">
    <section class="panel controls-panel">
      <div class="tabs">
        <button class="tab-btn active" data-tab="layout">Layout</button>
        <button class="tab-btn" data-tab="finance">Finance</button>
        <button class="tab-btn" data-tab="notes">Notes</button>
      </div>

      <div id="tab_layout" class="tab-panel active">
        <h2>BESS power and energy</h2>
        <label>Grid export limit MW</label>
        <input id="grid_export_mw" type="number" value="50" min="0" step="1" />
        <label>Storage duration hours</label>
        <input id="duration_hours" type="number" value="3" min="0" step="0.25" />
        <label>Required energy MWh</label>
        <input id="energy_mwh" type="number" value="150" min="0" step="1" />
        <button id="btn_sync_energy" class="action">Set MWh from MW x hours</button>

        <h2>BESS containers</h2>
        <label>Container size</label>
        <select id="container_size">
          <option value="20ft">20 ft</option>
          <option value="40ft" selected>40 ft</option>
        </select>
        <label>Energy per container MWh</label>
        <input id="container_mwh" type="number" value="5" min="0.1" step="0.1" />
        <label>Container length m</label>
        <input id="container_length_m" type="number" value="12.2" min="1" step="0.1" />
        <label>Container width m</label>
        <input id="container_width_m" type="number" value="2.44" min="1" step="0.01" />
        <label>Container spacing m</label>
        <input id="container_spacing_m" type="number" value="2.5" min="0" step="0.1" />
        <label>Containers per row</label>
        <input id="containers_per_row" type="number" value="10" min="1" step="1" />
        <label>Row spacing m</label>
        <input id="row_spacing_m" type="number" value="6" min="0" step="0.5" />

        <h2>PCS and transformer arrangement</h2>
        <label>BESS layout mode</label>
        <select id="layout_mode">
          <option value="integrated">Integrated PCS transformer station</option>
          <option value="separated">External transformer with separate PCS</option>
          <option value="distributed">Distributed PCS islands</option>
          <option value="corridor">PCS corridor layout</option>
          <option value="central">Central PCS block</option>
          <option value="hv_compound">Transmission scale HV compound</option>
        </select>
        <label>PCS rating MW</label>
        <input id="pcs_rating_mw" type="number" value="50" min="0.1" step="0.1" />
        <label>Containers per PCS</label>
        <input id="containers_per_pcs" type="number" value="30" min="1" step="1" />
        <label>Access road width m</label>
        <input id="access_road_m" type="number" value="6" min="0" step="0.5" />
        <label>Fire or acoustic wall</label>
        <select id="barrier_mode">
          <option value="none">Not shown</option>
          <option value="fire">Fire separation wall</option>
          <option value="acoustic">Acoustic wall</option>
          <option value="both">Fire and acoustic barrier</option>
        </select>
      </div>

      <div id="tab_finance" class="tab-panel">
        <h2>BESS financial assumptions</h2>
        <label>BESS CAPEX £ per MWh</label>
        <input id="capex_per_mwh" type="number" value="180000" min="0" step="1000" />
        <label>PCS CAPEX £ per MW</label>
        <input id="pcs_capex_per_mw" type="number" value="55000" min="0" step="1000" />
        <label>Civils and installation allowance £</label>
        <input id="civils_allowance" type="number" value="2500000" min="0" step="10000" />
        <label>Transformer and MV allowance £</label>
        <input id="mv_allowance" type="number" value="3000000" min="0" step="10000" />
        <label>Contingency percent</label>
        <input id="contingency_pct" type="number" value="10" min="0" step="0.5" />
        <label>Revenue £ per MW per year</label>
        <input id="revenue_per_mw_year" type="number" value="70000" min="0" step="1000" />
        <label>Availability percent</label>
        <input id="availability_pct" type="number" value="96" min="0" max="100" step="0.5" />
        <label>Analysis years</label>
        <input id="analysis_years" type="number" value="15" min="1" step="1" />
      </div>

      <div id="tab_notes" class="tab-panel">
        <h2>Scope notes</h2>
        <p>This V8 app is the BESS layout, map, SLD and financial screening frame.</p>
        <p>It intentionally excludes cable sizing, cable impedance, thermal derating, reverse current calculation, leakage calculation, fault withstand and protection coordination. Those belong in the advanced BESS Electrical Topology Review.</p>
        <p>Future advanced versions should allow a client substation footprint, customer switchroom, MV compound or HV interface area to be drawn and sized as a separate grid connection zone. This is intentionally excluded from the first BESS layout version to keep the app focused on BESS containers, PCS blocks, transformer arrangement, access and commercial screening.</p>
      </div>
    </section>

    <section class="panel summary-panel">
      <h2>Calculated BESS block</h2>
      <div class="stat"><span>Required energy</span><strong id="out_energy">150 MWh</strong></div>
      <div class="stat"><span>Container count</span><strong id="out_containers">30</strong></div>
      <div class="stat"><span>PCS count</span><strong id="out_pcs_count">1</strong></div>
      <div class="stat"><span>Total PCS power</span><strong id="out_pcs_power">50 MW</strong></div>
      <div class="stat"><span>Export cap</span><strong id="out_export">50 MW</strong></div>
      <div class="stat"><span>Duration</span><strong id="out_duration">3 h</strong></div>
      <div class="stat"><span>Approximate BESS field</span><strong id="out_footprint">0 m x 0 m</strong></div>
      <div class="stat"><span>Indicative CAPEX</span><strong id="out_capex">£0</strong></div>
      <div class="stat"><span>Indicative annual revenue</span><strong id="out_revenue">£0</strong></div>
      <div class="stat"><span>Simple payback</span><strong id="out_payback">0 years</strong></div>
      <div id="logic_box" class="logic-box">BESS containers provide MWh. PCS provides MW. Grid export caps maximum output.</div>
    </section>

    <section class="panel map-panel">
      <div class="map-toolbar">
        <button id="btn_satellite" type="button">Satellite view</button>
        <button id="btn_dark" type="button">Dark matter view</button>
        <button id="btn_draw_at_center" type="button">Draw BESS at map centre</button>
        <button id="btn_fit" type="button">Fit drawing</button>
      </div>
      <div id="map"></div>
    </section>

    <section class="panel drawing-panel">
      <div class="drawing-title">BESS layout and SLD preview</div>
      <svg id="bess_svg" viewBox="0 0 1400 840" role="img" aria-label="BESS layout and SLD preview"></svg>
    </section>
  </main>
</div>
<script src="./bess-gis-sld-financial-sandbox.js"></script>
</body>
</html>
'''

CSS = r'''* { box-sizing: border-box; }
:root { --bg:#050505; --panel:#0b0e14; --line:#2f343d; --text:#fff; --muted:#a6adbb; --accent:#00ffff; --ok:#00ff88; --warn:#ff9900; --bad:#ff3333; }
body { margin:0; background:var(--bg); color:var(--text); font-family:'Courier New', monospace; }
.app-shell { padding:22px; }
.topbar { display:flex; justify-content:space-between; gap:18px; border:1px solid var(--line); background:rgba(10,10,10,.96); border-radius:14px; padding:20px; margin-bottom:18px; }
.kicker { color:var(--accent); text-transform:uppercase; letter-spacing:.14em; font-size:12px; }
h1 { margin:8px 0 8px 0; font-size:28px; }
h2 { color:var(--accent); font-size:18px; border-bottom:1px solid var(--line); padding-bottom:6px; margin:18px 0 10px 0; }
p { color:var(--muted); line-height:1.55; }
.topbar-actions { display:flex; gap:8px; flex-wrap:wrap; align-content:flex-start; justify-content:flex-end; }
a, button { font-family:inherit; }
.topbar-actions a, .topbar-actions button, .map-toolbar button, .action, .tab-btn { border:1px solid var(--accent); color:var(--accent); background:#050505; border-radius:6px; padding:9px 12px; text-decoration:none; cursor:pointer; }
.workspace { display:grid; grid-template-columns:360px 1fr; gap:18px; align-items:start; }
.panel { border:1px solid var(--line); background:var(--panel); border-radius:14px; padding:18px; }
.controls-panel { grid-row: span 2; }
.tabs { display:grid; grid-template-columns:repeat(3,1fr); gap:6px; margin-bottom:12px; }
.tab-btn.active { color:var(--ok); border-color:var(--ok); }
.tab-panel { display:none; }
.tab-panel.active { display:block; }
label { display:block; color:var(--muted); font-size:13px; margin:10px 0 4px 0; }
input, select { width:100%; background:#050505; color:#fff; border:1px solid #444; border-radius:5px; padding:9px; font-family:inherit; }
.action { width:100%; margin-top:10px; color:var(--ok); border-color:var(--ok); font-weight:bold; }
.stat { display:flex; justify-content:space-between; gap:12px; padding:10px 0; border-bottom:1px solid #222; }
.stat span { color:var(--muted); }
.stat strong { color:var(--ok); text-align:right; }
.logic-box { margin-top:14px; border:1px solid var(--warn); color:var(--warn); background:rgba(255,153,0,.08); border-radius:10px; padding:14px; line-height:1.5; }
.map-panel { min-height:520px; }
.map-toolbar { display:flex; flex-wrap:wrap; gap:8px; margin-bottom:10px; }
#map { width:100%; height:480px; border:1px solid #222; border-radius:10px; overflow:hidden; }
.drawing-panel { grid-column:1 / -1; }
.drawing-title { color:var(--accent); font-weight:bold; margin-bottom:12px; }
svg { width:100%; height:auto; background:#030303; border:1px solid #222; border-radius:10px; }
.svg-battery { fill:#102018; stroke:#00ff88; stroke-width:2; }
.svg-pcs { fill:#081018; stroke:#00ffff; stroke-width:3; }
.svg-tx { fill:#141008; stroke:#ff9900; stroke-width:3; }
.svg-grid { fill:#111; stroke:#fff; stroke-width:2; }
.svg-road { fill:#25180f; opacity:.95; }
.svg-boundary { fill:none; stroke:#2b7cff; stroke-width:3; stroke-dasharray:12 8; }
.svg-wall { fill:#5a3b20; opacity:.9; }
.svg-line { stroke:#00ffff; stroke-width:4; fill:none; }
.svg-dc { stroke:#ff9900; stroke-width:3; fill:none; }
.svg-text { fill:#fff; font-family:'Courier New', monospace; font-size:18px; font-weight:bold; }
.svg-small { fill:#a6adbb; font-family:'Courier New', monospace; font-size:13px; }
@media (max-width: 980px) { .app-shell { padding:14px; } .topbar { flex-direction:column; } .workspace { grid-template-columns:1fr; } .controls-panel { grid-row:auto; } #map { height:420px; } }
@media print { body { background:#fff; color:#000; } .topbar, .panel { background:#fff; border-color:#000; } .topbar-actions, .map-toolbar, .tabs { display:none; } .tab-panel { display:block; } #map { height:320px; } }
'''

JS = r'''const state = { map: null, satellite: false };

const darkStyle = 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json';
const satStyle = {
  version: 8,
  sources: {
    satellite: {
      type: 'raster',
      tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],
      tileSize: 256,
      attribution: 'Tiles © Esri'
    }
  },
  layers: [{ id: 'satellite', type: 'raster', source: 'satellite' }]
};

function n(id, fallback = 0) {
  const value = parseFloat(document.getElementById(id)?.value || fallback);
  return Number.isFinite(value) ? value : fallback;
}

function v(id, fallback = '') { return document.getElementById(id)?.value || fallback; }
function setText(id, text) { const el = document.getElementById(id); if (el) el.textContent = text; }
function fmt(value, digits = 2) { return Number.isFinite(value) ? value.toLocaleString(undefined, { maximumFractionDigits: digits }) : '0'; }
function gbp(value) { return '£' + fmt(value, 0); }

function initMap() {
  if (!window.maplibregl) return;
  state.map = new maplibregl.Map({ container: 'map', style: darkStyle, center: [-0.1276, 51.5072], zoom: 10 });
  state.map.addControl(new maplibregl.NavigationControl({ showCompass: true }), 'bottom-right');
}

function switchStyle(style) {
  if (!state.map) return;
  state.map.setStyle(style);
}

function applyContainerPreset() {
  const size = v('container_size', '40ft');
  const length = document.getElementById('container_length_m');
  const width = document.getElementById('container_width_m');
  if (size === '20ft') {
    if (length) length.value = '6.1';
    if (width) width.value = '2.44';
  } else {
    if (length) length.value = '12.2';
    if (width) width.value = '2.44';
  }
}

function syncEnergy() {
  const mw = n('grid_export_mw', 50);
  const hours = n('duration_hours', 3);
  const energy = document.getElementById('energy_mwh');
  if (energy) energy.value = fmt(mw * hours, 2);
  updateAll();
}

function calc() {
  const exportMw = n('grid_export_mw', 50);
  const hours = n('duration_hours', 3);
  const energy = n('energy_mwh', exportMw * hours);
  const containerMwh = Math.max(0.1, n('container_mwh', 5));
  const pcsRating = Math.max(0.1, n('pcs_rating_mw', 50));
  const containersPerPcs = Math.max(1, Math.round(n('containers_per_pcs', 30)));
  const containers = Math.max(1, Math.ceil(energy / containerMwh));
  const pcsByPower = Math.max(1, Math.ceil(exportMw / pcsRating));
  const pcsByContainers = Math.max(1, Math.ceil(containers / containersPerPcs));
  const pcsCount = Math.max(pcsByPower, pcsByContainers);
  const pcsPower = pcsCount * pcsRating;
  const actualHours = exportMw > 0 ? energy / exportMw : 0;
  const cpr = Math.max(1, Math.round(n('containers_per_row', 10)));
  const rows = Math.max(1, Math.ceil(containers / cpr));
  const lengthM = Math.max(1, n('container_length_m', 12.2));
  const widthM = Math.max(1, n('container_width_m', 2.44));
  const spacingM = Math.max(0, n('container_spacing_m', 2.5));
  const rowSpacingM = Math.max(0, n('row_spacing_m', 6));
  const fieldLength = cpr * lengthM + Math.max(0, cpr - 1) * spacingM;
  const fieldWidth = rows * widthM + Math.max(0, rows - 1) * rowSpacingM;
  const capex = energy * n('capex_per_mwh', 180000) + pcsPower * n('pcs_capex_per_mw', 55000) + n('civils_allowance', 2500000) + n('mv_allowance', 3000000);
  const capexWithCont = capex * (1 + n('contingency_pct', 10) / 100);
  const revenue = exportMw * n('revenue_per_mw_year', 70000) * (n('availability_pct', 96) / 100);
  const payback = revenue > 0 ? capexWithCont / revenue : 0;
  return { exportMw, hours, energy, containerMwh, pcsRating, containersPerPcs, containers, pcsCount, pcsPower, actualHours, cpr, rows, lengthM, widthM, spacingM, rowSpacingM, fieldLength, fieldWidth, capexWithCont, revenue, payback, layoutMode: v('layout_mode', 'integrated'), barrierMode: v('barrier_mode', 'none'), accessRoadM: n('access_road_m', 6) };
}

function updateSummary(c) {
  setText('out_energy', fmt(c.energy, 2) + ' MWh');
  setText('out_containers', String(c.containers));
  setText('out_pcs_count', String(c.pcsCount));
  setText('out_pcs_power', fmt(c.pcsPower, 2) + ' MW');
  setText('out_export', fmt(c.exportMw, 2) + ' MW');
  setText('out_duration', fmt(c.actualHours, 2) + ' h');
  setText('out_footprint', fmt(c.fieldLength, 1) + ' m x ' + fmt(c.fieldWidth, 1) + ' m');
  setText('out_capex', gbp(c.capexWithCont));
  setText('out_revenue', gbp(c.revenue));
  setText('out_payback', fmt(c.payback, 1) + ' years');
  const logic = document.getElementById('logic_box');
  if (logic) {
    logic.textContent = `${fmt(c.containers,0)} BESS containers provide ${fmt(c.energy,1)} MWh. ${fmt(c.pcsCount,0)} PCS block(s) provide ${fmt(c.pcsPower,1)} MW installed PCS power. Grid export is capped at ${fmt(c.exportMw,1)} MW.`;
  }
}

function svgEl(tag, attrs = {}) {
  const el = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const [k, val] of Object.entries(attrs)) el.setAttribute(k, String(val));
  return el;
}

function svgText(svg, x, y, text, cls = 'svg-small', anchor = 'start') {
  const t = svgEl('text', { x, y, class: cls, 'text-anchor': anchor });
  t.textContent = text;
  svg.appendChild(t);
}

function drawLayout(c) {
  const svg = document.getElementById('bess_svg');
  if (!svg) return;
  svg.innerHTML = '';
  svg.appendChild(svgEl('rect', { x: 45, y: 45, width: 1310, height: 610, rx: 18, class: 'svg-boundary' }));
  svg.appendChild(svgEl('rect', { x: 80, y: 330, width: 1180, height: 52, class: 'svg-road' }));
  svgText(svg, 670, 363, 'access road and maintenance corridor', 'svg-small', 'middle');

  if (c.barrierMode !== 'none') {
    svg.appendChild(svgEl('rect', { x: 70, y: 94, width: 20, height: 505, class: 'svg-wall' }));
    svgText(svg, 105, 120, c.barrierMode === 'fire' ? 'fire wall' : c.barrierMode === 'acoustic' ? 'acoustic wall' : 'fire and acoustic barrier', 'svg-small');
  }

  const maxShow = Math.min(c.containers, 80);
  const cols = Math.min(c.cpr, 12);
  const rows = Math.ceil(maxShow / cols);
  const startX = 130;
  const startY = 90;
  const boxW = 70;
  const boxH = 32;
  const gapX = 12;
  const gapY = 18;
  for (let i = 0; i < maxShow; i++) {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const x = startX + col * (boxW + gapX);
    const y = startY + row * (boxH + gapY);
    svg.appendChild(svgEl('rect', { x, y, width: boxW, height: boxH, rx: 5, class: 'svg-battery' }));
  }
  svgText(svg, startX, startY - 18, `BESS containers shown ${maxShow} of ${c.containers}`, 'svg-text');

  const pcsY = c.layoutMode === 'corridor' ? 395 : 110;
  const pcsXBase = c.layoutMode === 'central' ? 910 : 860;
  const pcsShown = Math.min(c.pcsCount, 10);
  for (let i = 0; i < pcsShown; i++) {
    const x = pcsXBase + (i % 2) * 120;
    const y = pcsY + Math.floor(i / 2) * 82;
    if (c.layoutMode === 'integrated') {
      svg.appendChild(svgEl('rect', { x, y, width: 185, height: 58, rx: 8, class: 'svg-pcs' }));
      svgText(svg, x + 92, y + 25, 'PCS TX', 'svg-text', 'middle');
      svgText(svg, x + 92, y + 45, 'integrated', 'svg-small', 'middle');
    } else {
      svg.appendChild(svgEl('rect', { x, y, width: 82, height: 58, rx: 8, class: 'svg-pcs' }));
      svgText(svg, x + 41, y + 34, 'PCS', 'svg-text', 'middle');
    }
  }

  if (c.layoutMode !== 'integrated') {
    svg.appendChild(svgEl('rect', { x: 1115, y: 115, width: 130, height: 80, rx: 8, class: 'svg-tx' }));
    svgText(svg, 1180, 150, 'TX', 'svg-text', 'middle');
    svgText(svg, 1180, 174, 'external', 'svg-small', 'middle');
  }

  if (c.layoutMode === 'hv_compound') {
    svg.appendChild(svgEl('rect', { x: 1010, y: 430, width: 250, height: 130, rx: 8, class: 'svg-grid' }));
    svgText(svg, 1135, 485, 'HV compound', 'svg-text', 'middle');
    svgText(svg, 1135, 515, 'future detailed version', 'svg-small', 'middle');
  }

  svg.appendChild(svgEl('path', { d: 'M780 210 C820 240 830 285 860 330', class: 'svg-dc' }));
  svg.appendChild(svgEl('path', { d: 'M1030 180 L1120 180', class: 'svg-line' }));
  svg.appendChild(svgEl('rect', { x: 1120, y: 650, width: 170, height: 70, rx: 8, class: 'svg-grid' }));
  svgText(svg, 1205, 680, 'Grid export', 'svg-text', 'middle');
  svgText(svg, 1205, 704, `${fmt(c.exportMw,1)} MW cap`, 'svg-small', 'middle');
  svg.appendChild(svgEl('path', { d: 'M1180 195 L1180 650', class: 'svg-line' }));

  svgText(svg, 70, 700, `Mode: ${c.layoutMode.replaceAll('_',' ')}`, 'svg-text');
  svgText(svg, 70, 730, 'Layout screening only. Cable sizing and protection validation remain in the advanced topology review.', 'svg-small');
}

function updateAll() {
  const c = calc();
  updateSummary(c);
  drawLayout(c);
}

function bindEvents() {
  document.querySelectorAll('input, select').forEach(el => {
    el.addEventListener('input', updateAll);
    el.addEventListener('change', updateAll);
  });
  document.getElementById('container_size')?.addEventListener('change', () => { applyContainerPreset(); updateAll(); });
  document.getElementById('btn_sync_energy')?.addEventListener('click', syncEnergy);
  document.getElementById('btn_print')?.addEventListener('click', () => window.print());
  document.getElementById('btn_satellite')?.addEventListener('click', () => switchStyle(satStyle));
  document.getElementById('btn_dark')?.addEventListener('click', () => switchStyle(darkStyle));
  document.getElementById('btn_draw_at_center')?.addEventListener('click', () => updateAll());
  document.getElementById('btn_fit')?.addEventListener('click', () => { if (state.map) state.map.flyTo({ zoom: 10 }); });
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById('tab_' + btn.dataset.tab)?.classList.add('active');
    });
  });
}

document.addEventListener('DOMContentLoaded', () => { bindEvents(); initMap(); updateAll(); });
'''

README = r'''# BESS GIS SLD Financial Sandbox V8

This is the main BESS only V8 app.

It keeps the GIS, SLD and financial sandbox concept but removes PV specific logic.

## Included

- CARTO dark map base.
- Satellite base toggle.
- BESS energy and power inputs.
- 20 ft and 40 ft container assumptions.
- Energy per container.
- PCS rating.
- Containers per PCS.
- BESS layout modes.
- Integrated PCS transformer option.
- Separate PCS plus external transformer option.
- Distributed PCS islands.
- PCS corridor layout.
- Central PCS block.
- Transmission scale HV compound placeholder.
- Compound boundary.
- Access road and maintenance corridor.
- Fire or acoustic barrier placeholder.
- Indicative BESS CAPEX and revenue screening.
- SVG layout and SLD preview.

## Excluded from this app

- Cable sizing.
- Cable ampacity.
- Cable R, X and Z calculation.
- Thermal derating.
- Fault withstand.
- Protection coordination.
- Reverse current calculation.
- Earth fault calculation.
- Insulation monitoring validation.

Those items belong in:

```text
solar-bess-topology-v8/bess-electrical-topology-review/
```

## Future notes

Future advanced versions should allow a client substation footprint, customer switchroom, MV compound or HV interface area to be drawn and sized as a separate grid connection zone. This is intentionally excluded from the first BESS layout version to keep the app focused on BESS containers, PCS blocks, transformer arrangement, access and commercial screening.
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
<p>V8 is a standalone BESS study workspace. V7 is left as the stable solar and BESS GIS SLD release for now. V9 may later merge proven solar and BESS logic into one UI.</p>
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

V8_README = r'''# GlobalGrid2050 V8

V8 is the standalone BESS study workspace.

V7 remains stable. V8 is where standalone BESS logic is developed before any future V9 merge back into a unified Solar plus BESS UI.

## Current apps

```text
solar-bess-topology-v8/bess-gis-sld-financial-sandbox/
solar-bess-topology-v8/bess-electrical-topology-review/
```

## Main app boundary

The BESS GIS SLD Financial Sandbox handles:

- BESS containers.
- PCS blocks.
- Integrated PCS transformer layout.
- Separate PCS plus external transformer layout.
- Distributed PCS islands.
- PCS corridor layout.
- Central PCS block.
- Transmission scale HV compound placeholder.
- Access roads.
- Fire or acoustic barriers.
- Basic MW, MWh, CAPEX and revenue screening.

It does not handle cable sizing or protection validation.

## Advanced review boundary

The BESS Electrical Topology Review handles cable, impedance, leakage, reverse current, transformer impedance, fault level and formal study flags.
'''

LEGACY_INDEX = r'''<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<meta http-equiv="refresh" content="0; url=../bess-gis-sld-financial-sandbox/index.html" />
<title>BESS PCS Standalone Redirect</title>
</head>
<body style="background:#000;color:#fff;font-family:Courier,monospace;padding:30px;">
<p>The V8 BESS PCS standalone app has been replaced by the BESS GIS SLD Financial Sandbox.</p>
<p><a style="color:#66ccff;" href="../bess-gis-sld-financial-sandbox/index.html">Open BESS GIS SLD Financial Sandbox</a></p>
</body>
</html>
'''


def write(path: Path, text: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text, encoding="utf-8")


def main() -> int:
    write(APP / "index.html", INDEX_HTML)
    write(APP / "bess-gis-sld-financial-sandbox.css", CSS)
    write(APP / "bess-gis-sld-financial-sandbox.js", JS)
    write(APP / "README.md", README)
    write(V8 / "index.html", V8_INDEX)
    write(V8 / "README.md", V8_README)
    write(LEGACY / "index.html", LEGACY_INDEX)

    REPORT.parent.mkdir(parents=True, exist_ok=True)
    REPORT.write_text("\n".join([
        "# Build V8 BESS GIS SLD Financial Sandbox",
        "",
        f"UTC created: {dt.datetime.now(dt.timezone.utc).isoformat()}",
        "",
        "## Created",
        "",
        "```text",
        "solar-bess-topology-v8/bess-gis-sld-financial-sandbox/",
        "```",
        "",
        "## Replaced",
        "",
        "The old BESS PCS standalone entry point now redirects to the new BESS GIS SLD Financial Sandbox.",
        "",
        "## Boundary",
        "",
        "The main BESS sandbox excludes cable sizing and protection coordination. Those remain in the advanced BESS Electrical Topology Review.",
        "",
        "## V7 protection",
        "",
        "No V7 files are modified.",
        "",
    ]), encoding="utf-8")
    print("Built V8 BESS GIS SLD Financial Sandbox.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
