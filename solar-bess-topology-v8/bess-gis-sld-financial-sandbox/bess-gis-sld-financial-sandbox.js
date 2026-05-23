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


// --- V8 geospatial BESS layout drawing ---
// Layout only. No cable sizing, impedance, thermal or protection coordination logic here.
state.bessGeoJson = { type: 'FeatureCollection', features: [] };

function metresToLngLat(origin, eastM, northM) {
  const lat = origin.lat;
  const lng = origin.lng;
  const dLat = northM / 111320;
  const dLng = eastM / (111320 * Math.cos(lat * Math.PI / 180));
  return [lng + dLng, lat + dLat];
}

function rotatePoint(x, y, deg) {
  const rad = deg * Math.PI / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  return [x * cos - y * sin, x * sin + y * cos];
}

function rectFeature(origin, cx, cy, w, h, rotationDeg, props) {
  const corners = [
    [-w / 2, -h / 2],
    [w / 2, -h / 2],
    [w / 2, h / 2],
    [-w / 2, h / 2],
    [-w / 2, -h / 2]
  ].map(([x, y]) => {
    const [rx, ry] = rotatePoint(cx + x, cy + y, rotationDeg);
    return metresToLngLat(origin, rx, ry);
  });
  return {
    type: 'Feature',
    properties: props,
    geometry: { type: 'Polygon', coordinates: [corners] }
  };
}

function pointFeature(origin, eastM, northM, rotationDeg, props) {
  const [rx, ry] = rotatePoint(eastM, northM, rotationDeg);
  return {
    type: 'Feature',
    properties: props,
    geometry: { type: 'Point', coordinates: metresToLngLat(origin, rx, ry) }
  };
}

function lineFeature(origin, points, rotationDeg, props) {
  return {
    type: 'Feature',
    properties: props,
    geometry: {
      type: 'LineString',
      coordinates: points.map(([x, y]) => {
        const [rx, ry] = rotatePoint(x, y, rotationDeg);
        return metresToLngLat(origin, rx, ry);
      })
    }
  };
}

function buildBessGeoJsonAt(origin) {
  const c = calc();
  const rotation = n('geo_rotation_deg', 0);
  const features = [];
  const cols = Math.max(1, Math.min(c.cpr, 30));
  const rows = Math.max(1, Math.ceil(c.containers / cols));
  const boxW = Math.max(2, c.lengthM);
  const boxH = Math.max(2, c.widthM);
  const pitchX = boxW + c.spacingM;
  const pitchY = boxH + c.rowSpacingM;
  const fieldW = cols * boxW + Math.max(0, cols - 1) * c.spacingM;
  const fieldH = rows * boxH + Math.max(0, rows - 1) * c.rowSpacingM;
  const originX = -fieldW / 2;
  const originY = fieldH / 2;
  const boundaryPad = Math.max(25, c.accessRoadM * 3);
  const electricalX = fieldW / 2 + 55;
  const roadY = -fieldH / 2 - Math.max(18, c.accessRoadM);

  features.push(rectFeature(origin, 0, 0, fieldW + boundaryPad * 2 + 220, fieldH + boundaryPad * 2 + 120, rotation, {
    role: 'compound_boundary',
    label: 'BESS compound boundary',
    layout_mode: c.layoutMode
  }));

  features.push(rectFeature(origin, 0, roadY, fieldW + boundaryPad * 2 + 160, Math.max(6, c.accessRoadM), rotation, {
    role: 'access_road',
    label: 'Access road and maintenance corridor'
  }));

  if (c.barrierMode !== 'none') {
    features.push(rectFeature(origin, originX - boundaryPad / 2, 0, 4, fieldH + boundaryPad, rotation, {
      role: 'barrier',
      label: c.barrierMode === 'fire' ? 'Fire separation wall' : c.barrierMode === 'acoustic' ? 'Acoustic wall' : 'Fire and acoustic barrier'
    }));
  }

  for (let i = 0; i < c.containers; i++) {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const x = originX + boxW / 2 + col * pitchX;
    const y = originY - boxH / 2 - row * pitchY;
    features.push(rectFeature(origin, x, y, boxW, boxH, rotation, {
      role: 'bess_container',
      label: 'BESS container ' + (i + 1),
      container_mwh: c.containerMwh
    }));
  }

  const pcsBlockW = c.layoutMode === 'integrated' ? 22 : 14;
  const pcsBlockH = 10;
  const pcsShown = Math.min(c.pcsCount, 40);
  for (let i = 0; i < pcsShown; i++) {
    let x = electricalX;
    let y = originY - i * (pcsBlockH + 6);
    if (c.layoutMode === 'distributed') {
      x = originX + (i % Math.max(1, Math.min(cols, c.pcsCount))) * pitchX;
      y = originY + 26 + Math.floor(i / Math.max(1, cols)) * 16;
    } else if (c.layoutMode === 'corridor') {
      x = originX + fieldW / 2;
      y = roadY - 25 - i * 15;
    } else if (c.layoutMode === 'central') {
      x = electricalX;
      y = 0;
    }
    features.push(rectFeature(origin, x, y, pcsBlockW, pcsBlockH, rotation, {
      role: c.layoutMode === 'integrated' ? 'integrated_pcs_transformer' : 'pcs_block',
      label: c.layoutMode === 'integrated' ? 'Integrated PCS transformer ' + (i + 1) : 'PCS block ' + (i + 1),
      pcs_mw: c.pcsRating
    }));
  }

  if (c.layoutMode !== 'integrated') {
    features.push(rectFeature(origin, electricalX + 42, 0, 28, 18, rotation, {
      role: 'external_transformer',
      label: 'External transformer zone'
    }));
  }

  if (c.layoutMode === 'hv_compound') {
    features.push(rectFeature(origin, electricalX + 88, -36, 58, 38, rotation, {
      role: 'hv_compound_placeholder',
      label: 'Future HV compound placeholder'
    }));
  }

  features.push(pointFeature(origin, electricalX + 120, roadY - 50, rotation, {
    role: 'grid_export_point',
    label: 'Grid export point',
    export_mw: c.exportMw
  }));

  features.push(lineFeature(origin, [[fieldW / 2, 0], [electricalX - 10, 0]], rotation, {
    role: 'dc_collection_path',
    label: 'Indicative DC collection path, not cable sizing'
  }));

  return { type: 'FeatureCollection', features };
}

function ensureBessGeoLayers() {
  if (!state.map) return;
  if (!state.map.getSource('bess-geo-layout')) {
    state.map.addSource('bess-geo-layout', { type: 'geojson', data: state.bessGeoJson });
  }
  const fillLayers = [
    ['bess-boundary-fill', ['==', ['get', 'role'], 'compound_boundary'], 'rgba(43,124,255,0.08)', 'rgba(43,124,255,0.75)'],
    ['bess-container-fill', ['==', ['get', 'role'], 'bess_container'], 'rgba(0,255,136,0.38)', 'rgba(0,255,136,0.95)'],
    ['bess-pcs-fill', ['any', ['==', ['get', 'role'], 'pcs_block'], ['==', ['get', 'role'], 'integrated_pcs_transformer']], 'rgba(0,255,255,0.38)', 'rgba(0,255,255,0.95)'],
    ['bess-transformer-fill', ['any', ['==', ['get', 'role'], 'external_transformer'], ['==', ['get', 'role'], 'hv_compound_placeholder']], 'rgba(255,153,0,0.38)', 'rgba(255,153,0,0.95)'],
    ['bess-road-fill', ['==', ['get', 'role'], 'access_road'], 'rgba(120,80,40,0.55)', 'rgba(120,80,40,0.95)'],
    ['bess-barrier-fill', ['==', ['get', 'role'], 'barrier'], 'rgba(255,80,80,0.45)', 'rgba(255,80,80,0.95)']
  ];
  fillLayers.forEach(([id, filter, fill, outline]) => {
    if (!state.map.getLayer(id)) {
      state.map.addLayer({ id, type: 'fill', source: 'bess-geo-layout', filter, paint: { 'fill-color': fill, 'fill-outline-color': outline } });
    }
  });
  if (!state.map.getLayer('bess-path-line')) {
    state.map.addLayer({ id: 'bess-path-line', type: 'line', source: 'bess-geo-layout', filter: ['==', ['get', 'role'], 'dc_collection_path'], paint: { 'line-color': '#ff9900', 'line-width': 3, 'line-dasharray': [2, 2] } });
  }
  if (!state.map.getLayer('bess-grid-export-point')) {
    state.map.addLayer({ id: 'bess-grid-export-point', type: 'circle', source: 'bess-geo-layout', filter: ['==', ['get', 'role'], 'grid_export_point'], paint: { 'circle-radius': 7, 'circle-color': '#ffffff', 'circle-stroke-color': '#00ffff', 'circle-stroke-width': 2 } });
  }
}

function refreshBessGeoLayout() {
  if (!state.map || !state.bessGeoJson) return;
  ensureBessGeoLayers();
  const source = state.map.getSource('bess-geo-layout');
  if (source) source.setData(state.bessGeoJson);
}

function drawBessGeoLayoutAtMapCenter() {
  if (!state.map) return;
  const centre = state.map.getCenter();
  state.bessGeoJson = buildBessGeoJsonAt(centre);
  refreshBessGeoLayout();
  fitBessGeoLayout();
}

function resetBessGeoLayout() {
  state.bessGeoJson = { type: 'FeatureCollection', features: [] };
  refreshBessGeoLayout();
}

function fitBessGeoLayout() {
  if (!state.map || !state.bessGeoJson || !state.bessGeoJson.features.length) return;
  const coords = [];
  state.bessGeoJson.features.forEach(feature => {
    const geom = feature.geometry;
    if (!geom) return;
    if (geom.type === 'Point') coords.push(geom.coordinates);
    if (geom.type === 'LineString') coords.push(...geom.coordinates);
    if (geom.type === 'Polygon') coords.push(...geom.coordinates.flat());
  });
  if (!coords.length) return;
  const bounds = coords.reduce((b, coord) => b.extend(coord), new maplibregl.LngLatBounds(coords[0], coords[0]));
  state.map.fitBounds(bounds, { padding: 70, duration: 600 });
}

function exportBessGeoJson() {
  const blob = new Blob([JSON.stringify(state.bessGeoJson, null, 2)], { type: 'application/geo+json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'v8-bess-layout.geojson';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('btn_draw_at_center')?.addEventListener('click', drawBessGeoLayoutAtMapCenter);
  document.getElementById('btn_reset_geo')?.addEventListener('click', resetBessGeoLayout);
  document.getElementById('btn_export_geojson')?.addEventListener('click', exportBessGeoJson);
  document.getElementById('btn_fit')?.addEventListener('click', fitBessGeoLayout);
  document.querySelectorAll('input, select').forEach(el => {
    el.addEventListener('input', () => { if (state.bessGeoJson.features.length && state.map) drawBessGeoLayoutAtMapCenter(); });
    el.addEventListener('change', () => { if (state.bessGeoJson.features.length && state.map) drawBessGeoLayoutAtMapCenter(); });
  });
  setTimeout(() => {
    if (state.map) {
      state.map.on('style.load', refreshBessGeoLayout);
      state.map.on('load', refreshBessGeoLayout);
    }
  }, 500);
});

