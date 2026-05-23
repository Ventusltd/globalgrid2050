const state = { map: null, satellite: false };

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
