#!/usr/bin/env python3
"""Add geospatial BESS layout drawing to the V8 BESS GIS SLD sandbox.

This patch adds MapLibre GeoJSON drawing without touching V7.

Scope:
- Add map toolbar controls for geospatial draw, reset, export and rotation.
- Add BESS compound boundary, container polygons, PCS blocks, transformer zone,
  access road, grid export point and optional barrier as GeoJSON features.
- Keep cable sizing and protection coordination out of this layout app.
"""

from __future__ import annotations

import datetime as dt
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
APP = ROOT / "solar-bess-topology-v8" / "bess-gis-sld-financial-sandbox"
INDEX = APP / "index.html"
JS = APP / "bess-gis-sld-financial-sandbox.js"
REPORT = ROOT / "gridbot_reports" / "add_v8_bess_geospatial_layout_drawing.md"

INDEX_OLD = '''        <button id="btn_draw_at_center" type="button">Draw BESS at map centre</button>
        <button id="btn_fit" type="button">Fit drawing</button>'''

INDEX_NEW = '''        <button id="btn_draw_at_center" type="button">Draw BESS at map centre</button>
        <button id="btn_reset_geo" type="button">Reset map drawing</button>
        <button id="btn_export_geojson" type="button">Export GeoJSON</button>
        <label class="map-inline-label">Rotation °</label>
        <input id="geo_rotation_deg" class="map-inline-input" type="number" value="0" step="5" />
        <button id="btn_fit" type="button">Fit drawing</button>'''

CSS_APPEND = r'''
.map-inline-label { color: var(--muted); align-self:center; font-size:13px; }
.map-inline-input { width:90px; padding:8px; }
'''

JS_APPEND = r'''

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
'''


def patch_index() -> None:
    text = INDEX.read_text(encoding="utf-8")
    if "btn_reset_geo" not in text:
        if INDEX_OLD not in text:
            raise SystemExit("Map toolbar anchor not found in V8 BESS index.html")
        text = text.replace(INDEX_OLD, INDEX_NEW, 1)
    INDEX.write_text(text, encoding="utf-8")


def patch_css() -> None:
    css_path = APP / "bess-gis-sld-financial-sandbox.css"
    text = css_path.read_text(encoding="utf-8")
    if ".map-inline-input" not in text:
        text = text.rstrip() + "\n" + CSS_APPEND + "\n"
    css_path.write_text(text, encoding="utf-8")


def patch_js() -> None:
    text = JS.read_text(encoding="utf-8")
    if "function buildBessGeoJsonAt" not in text:
        text = text.rstrip() + "\n" + JS_APPEND + "\n"
    JS.write_text(text, encoding="utf-8")


def write_report() -> None:
    REPORT.parent.mkdir(parents=True, exist_ok=True)
    REPORT.write_text("\n".join([
        "# Add V8 BESS Geospatial Layout Drawing",
        "",
        f"UTC created: {dt.datetime.now(dt.timezone.utc).isoformat()}",
        "",
        "## App",
        "",
        "```text",
        "solar-bess-topology-v8/bess-gis-sld-financial-sandbox/",
        "```",
        "",
        "## Added",
        "",
        "- Draw BESS at map centre as MapLibre GeoJSON.",
        "- Compound boundary polygon.",
        "- BESS container polygons.",
        "- PCS and integrated PCS transformer polygons.",
        "- External transformer and HV compound placeholder polygons.",
        "- Access road and optional barrier polygons.",
        "- Grid export point.",
        "- Indicative DC collection line marked explicitly as not cable sizing.",
        "- Reset map drawing.",
        "- Export GeoJSON.",
        "- Rotation input.",
        "",
        "## Boundary",
        "",
        "No cable sizing, impedance, thermal derating, protection coordination, leakage or reverse current calculations are added to the layout app.",
        "",
        "## V7 protection",
        "",
        "No V7 files are modified.",
        "",
    ]), encoding="utf-8")


def main() -> int:
    if not APP.exists():
        raise SystemExit("V8 BESS GIS SLD Financial Sandbox app folder does not exist. Run the build workflow first.")
    patch_index()
    patch_css()
    patch_js()
    write_report()
    print("Added V8 BESS geospatial layout drawing.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
